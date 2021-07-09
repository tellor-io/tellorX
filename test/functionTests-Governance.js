const { AbiCoder } = require("@ethersproject/abi");
const { expect } = require("chai");
const h = require("./helpers/helpers");
var assert = require('assert');
const web3 = require('web3');

describe("TellorX Function Tests - Governance", function() {

    const tellorMaster = "0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0"
    const DEV_WALLET = "0x39E419bA25196794B595B2a595Ea8E527ddC9856"
    let accounts = null
    let tellor = null
    let cfac,ofac,tfac,gfac,devWallet
    let govSigner = null
  
  beforeEach("deploy and setup TellorX", async function() {
    accounts = await ethers.getSigners();
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [{forking: {
            jsonRpcUrl: hre.config.networks.hardhat.forking.url,
            blockNumber:12762660
          },},],
      });
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [DEV_WALLET]}
    )
        //Steps to Deploy:
        //Deploy Governance, Oracle, Treasury, and Controller. 
        //Fork mainnet Ethereum, changeTellorContract to Controller
        //run init in Controller

    oldTellorInstance = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor", tellorMaster)
    gfac = await ethers.getContractFactory("contracts/testing/TestGovernance.sol:TestGovernance");
    ofac = await ethers.getContractFactory("contracts/Oracle.sol:Oracle");
    tfac = await ethers.getContractFactory("contracts/Treasury.sol:Treasury");
    cfac = await ethers.getContractFactory("contracts/Controller.sol:Controller");
    governance = await gfac.deploy();
    oracle = await ofac.deploy();
    treasury = await tfac.deploy();
    controller = await cfac.deploy();
    await governance.deployed();
    await oracle.deployed();
    await treasury.deployed();
    await controller.deployed();
    await accounts[0].sendTransaction({to:DEV_WALLET,value:ethers.utils.parseEther("1.0")});
    devWallet = await ethers.provider.getSigner(DEV_WALLET);
    master = await oldTellorInstance.connect(devWallet)
    await master.changeTellorContract(controller.address);
    tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, devWallet);
    await tellor.deployed();
    await tellor.init(governance.address,oracle.address,treasury.address)
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [governance.address]}
    )
    await accounts[1].sendTransaction({to:governance.address,value:ethers.utils.parseEther("1.0")});
    govSigner = await ethers.provider.getSigner(governance.address);
  });
  it("constructor()", async function() {
    let initFuncs = [0x3c46a185,0xe8ce51d7,0x1cbd3151,0xbd87e0c9, 0x740358e6,
      0x40c10f19,0xe8a230db,0xfad40294,0xe280e8e8,0x6274885f,0xf3ff955a];
    for(let _i =0;_i< initFuncs.length;_i++){
      res = await governance.isFunctionApproved(initFuncs[_i])
      assert(res == true, "Function should be approved")
    }
  }).timeout(40000);
  it("setApprovedFunction()", async function() {
    h.expectThrow(governance.setApprovedFunction("0x3c46a185",false));//should fail, onlygovernance
    governance = await ethers.getContractAt("contracts/testing/TestGovernance.sol:TestGovernance",governance.address, govSigner);
    await governance.setApprovedFunction("0x3c46a185",false)
    await governance.setApprovedFunction("0x3c461111",true)
    assert(await governance.isFunctionApproved(0x3c461111) == true, "Function should be approved")
    assert(await governance.isFunctionApproved(0x3c46a185) == false, "Function should not be approved")
  });
  it("beginDispute()", async function() {
    oracle = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, govSigner);
    await oracle.addNewId(1)
    await oracle.addNewId(2)
    await tellor.transfer(accounts[1].address,web3.utils.toWei("200"));
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
    await tellorUser.depositStake();
    oracle = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[1]);
    await oracle.submitValue(1,300);
    let _t = await oracle.getReportTimestampByIndex(1,0);
    governance = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",governance.address, accounts[2]);
    h.expectThrow(governance.beginDispute(1,_t + 86400));//not a valid timestamp
    h.expectThrow(governance.beginDispute(1,_t + 86400));//no tokens to pay fee
    await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
    await governance.beginDispute(1,_t);
    let _hash = ethers.utils.solidityKeccak256(['uint256','uint256'], ['1',_t])
    let voteVars = await governance.getVoteInfo(1)
    assert(voteVars[0] == _hash, "identifier hash should be correct")
    assert(voteVars[1][0] == 1, "vote round should be 1")
    assert(voteVars[1][1] >= _t , "vote start date should be correct")
    assert(voteVars[1][2] > 0, "vote block number should be greater than 0")
    let _stakers = await tellor.getUintVar(h.hash("_STAKE_COUNT"))
    let _fee = web3.utils.toWei("100") - web3.utils.toWei("100") * _stakers/web3.utils.toBN("200")
    assert(voteVars[1][3] ==  _fee * 9/10, "fee should be correct")
    assert(voteVars[1][4] == 0, "tallyDate should be 0")
    console.log(voteVars[2][1],true, "should be a dispute", "why doesn't this work?")
    console.log(voteVars[6][1] == accounts[2].address, "initiator should be correct", "another flip, super wierd")
    let dispVars = await governance.getDisputeInfo(1);
    assert(dispVars[0] == 1, "requestId should be correct")
    assert(dispVars[1] - _t == 0, "timestamp should be correct")
    assert(dispVars[2] - 300 == 0, "value should be correct")
    assert(dispVars[3] == accounts[1].address, "reported Miner should be correct")
    assert(await governance.getOpenDisputesOnId(1) == 1, "number of disputes open on ID should be correct")
    assert(await oracle.getValueByTimestamp(1,_t) == "0x", "value should be removed")
    assert(await oracle.getTipsById(1) -.1 * _fee/2 == 0, "tip should have been added")
    let _stakerInfo = await tellor.getStakerInfo(accounts[1].address) ;
    assert(_stakerInfo[0] - 3 ==0, "miner should be disputed")
    await h.advanceTime(86400 * 2.5)
    await governance.tallyVotes(1)
    await tellor.transfer(accounts[3].address,web3.utils.toWei("200"));
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[3]);
    await tellorUser.depositStake();
    oracle = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[3]);
    await oracle.submitValue(2,301);
    let _t2 = oracle.getReportTimestampByIndex(2,0);
    await h.advanceTime(86400+1000)
    h.expectThrow(governance.beginDispute(1,_t))//cannot open a new round past a day
    h.expectThrow(governance.beginDispute(2,_t2))// must dispute withing 12 hours
  });
  it("delegate()", async function() {
    governance = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",governance.address, accounts[2]);
    await governance.delegate(DEV_WALLET);
    let vars = await governance.getDelegateInfo(accounts[2].address)
    assert(vars[0] == DEV_WALLET, "delegate should be correct")
    assert(vars[1] > 0, "block of delegation should be correct")
  });
  it("delegateOfAt()", async function() {
    governance = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",governance.address, accounts[2]);
    await governance.delegate(DEV_WALLET);
    let block2 = await ethers.provider.getBlock(); 
    await governance.delegate(accounts[1].address);
    let _num = block2.number * 1
    let del = await governance.delegateOfAt(accounts[2].address,_num)
    assert(del == DEV_WALLET, "delegate should be correct")
    block2 = await ethers.provider.getBlock(); 
    _num = block2.number * 1
    del = await governance.delegateOfAt(accounts[2].address,_num)
    assert(del == accounts[1].address, "delegate should be correct")
  });
  it("executeVote()", async function() {
    oracle = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, govSigner);
    await oracle.addNewId(1)
    await oracle.addNewId(2)
    await tellor.transfer(accounts[1].address,web3.utils.toWei("200"));
    await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
    h.expectThrow(governance.executeVote(2));//ID not yet valid
    await tellorUser.depositStake();
    oracle = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[1]);
    await oracle.submitValue(1,300);
    let initBalReporter = await tellor.balanceOf(accounts[1].address)
    let initBalDisputer = await tellor.balanceOf(accounts[2].address)
    let _t = await oracle.getReportTimestampByIndex(1,0);
    governance = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",governance.address, accounts[2]);
    devGovernance = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",governance.address, devWallet);
    await governance.beginDispute(1,_t);
    await devGovernance.vote(1,true,false)
    let _hash = ethers.utils.solidityKeccak256(['uint256','uint256'], ['1',_t])
    await h.advanceTime(86400 * 2.5)
    h.expectThrow(governance.executeVote(1));//must be tallied
    await governance.tallyVotes(1)
    let voteVars = await governance.getVoteInfo(1)
    await h.expectThrow(governance.executeVote(1)); //must wait a day
    await h.advanceTime(86400 * 1.5)
    await governance.executeVote(1)
    h.expectThrow(governance.executeVote(1));//vote has alrady been executed
    let finalBalReporter = await tellor.balanceOf(accounts[1].address)
    let finalBalDisputer = await tellor.balanceOf(accounts[2].address)
    voteVars = await governance.getVoteInfo(1)
    assert(finalBalDisputer - initBalDisputer - (await tellor.getUintVar(h.hash("_STAKE_AMOUNT"))*1 - (voteVars[1][3]*10/9 - voteVars[1][3])) == 0)
    assert(initBalReporter - finalBalReporter - await tellor.getUintVar(h.hash("_STAKE_AMOUNT")) == 0)
    await tellor.transfer(accounts[3].address,web3.utils.toWei("200"));
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[3]);
    await tellorUser.depositStake();
    oracle = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[3]);
    await oracle.submitValue(2,300);
    _t = await oracle.getReportTimestampByIndex(2,0);
    await governance.beginDispute(2,_t);
    await h.advanceTime(86400 * 3)
    await governance.tallyVotes(2)
    await governance.beginDispute(2,_t);
    await h.expectThrow(governance.executeVote(2));//must be the final vote
    await h.advanceTime(86400 * 3)
    await governance.tallyVotes(3)
    h.expectThrow(governance.executeVote(2));//must be the final vot
    await h.advanceTime(86400 * 2.5)
    await governance.executeVote(3)
    assert(voteVars[2][0] == true, "vote should be executed")
  });
//   it("proposeVote()", async function() {
//     assert(0==1)
//   });
//   it("tallyVotes()", async function() {
//     assert(0==1)
//   });
//   it("updateMinDisputeFee()", async function() {
//     assert(0==1)
//   });
//   it("verify()", async function() {
//     assert(await tellor.verify() > 9000, "Contract should properly verify")
//   });
//   it("vote()", async function() {
//     assert(0==1)
//   });
//   it("voteFor()", async function() {
//     assert(0==1)
//   });
//   it("_vote", async function() {
//     assert(0==1)
//   });
//   it("_min", async function() {
//     assert(0==1)
//   });
//   it("_max", async function() {
//     assert(0==1)
//   });
//   it("getDelegateInfo()", async function() {
//     governance = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",governance.address, accounts[2]);
//     await governance.delegate(DEV_WALLET);
//     await governance.delegate(accounts[1]);
//     let vars = await getDelegateInfo(accounts[2])
//     assert(vars[0] == accounts[1], "delegate should be correct")
//     assert(vars[1] > 0, "block of delegation should be correct")
//   });
//   it("isFunctionApproved()", async function() {
//     assert(0==1)
//   });
//   it("getVoteRounds()", async function() {
//     assert(0==1)
//   });
//   it("getVoteInfo()", async function() {
//     assert(0==1)
//   });
//   it("getDisputeInfo()", async function() {
//     assert(0==1)
//   });
//   it("getOpenDisputesOnId()", async function() {
//     assert(0==1)
//   });
//   it("didVote()", async function() {
//     assert(0==1)
//   });
});