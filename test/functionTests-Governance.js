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
    await tellor.transfer(accounts[1].address,web3.utils.toWei("200"));
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
    await tellorUser.depositStake();
    oracle = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[1]);
    await oracle.submitValue( ethers.utils.formatBytes32String("1"),300);
    let _t = await oracle.getReportTimestampByIndex(h.tob32("1"),0);
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[2]);
    h.expectThrow(governance.beginDispute(h.tob32("1"),_t + 86400));//not a valid timestamp
    h.expectThrow(governance.beginDispute(h.tob32("1"),_t + 86400));//no tokens to pay fee
    await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
    await governance.beginDispute(h.tob32("1"),_t);
    let _hash = ethers.utils.solidityKeccak256(['bytes32','uint256'], [h.tob32("1"),_t])
    let voteVars = await governance.getVoteInfo(1)
    assert(voteVars[0] == _hash, "identifier hash should be correct")
    assert(voteVars[1][0] == 1, "vote round should be 1")
    assert(voteVars[1][1] >= _t , "vote start date should be correct")
    assert(voteVars[1][2] > 0, "vote block number should be greater than 0")
    let _stakers = await tellor.getUintVar(h.hash("_STAKE_COUNT"))
    let _fee = web3.utils.toWei("100") - web3.utils.toWei("100") * _stakers/web3.utils.toBN("200")
    assert(voteVars[1][3] ==  _fee * 9/10, "fee should be correct")
    assert(voteVars[1][4] == 0, "tallyDate should be 0")
    assert(voteVars[2][1], "should be a dispute")
    assert(voteVars[6][1] == accounts[2].address, "initiator should be correct")
    let dispVars = await governance.getDisputeInfo(1);
    assert(dispVars[0] == h.tob32("1"), "requestId should be correct")
    assert(dispVars[1] - _t == 0, "timestamp should be correct")
    assert(dispVars[2] - 300 == 0, "value should be correct")
    assert(dispVars[3] == accounts[1].address, "reported Miner should be correct")
    assert(await governance.getOpenDisputesOnId(h.tob32("1")) == 1, "number of disputes open on ID should be correct")
    assert(await oracle.getValueByTimestamp(h.tob32("1"),_t) == "0x", "value should be removed")
    assert(await oracle.getTipsById(h.tob32("1")) -.1 * _fee/2 == 0, "tip should have been added")
    let _stakerInfo = await tellor.getStakerInfo(accounts[1].address) ;
    assert(_stakerInfo[0] - 3 ==0, "miner should be disputed")
    await h.advanceTime(86400 * 2.5)
    await governance.tallyVotes(1)
    await tellor.transfer(accounts[3].address,web3.utils.toWei("200"));
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[3]);
    await tellorUser.depositStake();
    oracle = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[3]);
    await oracle.submitValue(h.tob32("2"),301);
    let _t2 = oracle.getReportTimestampByIndex(h.tob32("2"),0);
    await h.advanceTime(86400+1000)
    h.expectThrow(governance.beginDispute(h.tob32("1"),_t))//cannot open a new round past a day
    h.expectThrow(governance.beginDispute(h.tob32("2"),_t2))// must dispute withing 12 hours
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
    await tellor.transfer(accounts[1].address,web3.utils.toWei("200"));
    await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
    h.expectThrow(governance.executeVote(2));//ID not yet valid
    await tellorUser.depositStake();
    oracle = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[1]);
    await oracle.submitValue(h.tob32("1"),300);
    let initBalReporter = await tellor.balanceOf(accounts[1].address)
    let initBalDisputer = await tellor.balanceOf(accounts[2].address)
    let _t = await oracle.getReportTimestampByIndex(h.tob32("1"),0);
    governance = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",governance.address, accounts[2]);
    devGovernance = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",governance.address, devWallet);
    await governance.beginDispute(h.tob32("1"),_t);
    await devGovernance.vote(1,true,false)
    let _hash = ethers.utils.solidityKeccak256(['bytes32','uint256'], [h.tob32("1"),_t])
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
    await oracle.submitValue(h.tob32("2"),300);
    _t = await oracle.getReportTimestampByIndex(h.tob32("2"),0);
    await governance.beginDispute(h.tob32("2"),_t);
    await h.advanceTime(86400 * 3)
    await governance.tallyVotes(2)
    await governance.beginDispute(h.tob32("2"),_t);
    await h.expectThrow(governance.executeVote(2));//must be the final vote
    await h.advanceTime(86400 * 3)
    await governance.tallyVotes(3)
    h.expectThrow(governance.executeVote(2));//must be the final vot
    await h.advanceTime(86400 * 2.5)
    await governance.executeVote(3)
    assert(voteVars[2][0] == true, "vote should be executed")
  });
  it("proposeVote()", async function() {
    let newController = await cfac.deploy();
    await newController.deployed();
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[1]);
    await h.expectThrow(governance.proposeVote(tellorMaster,0x3c46a185,newController.address,0));//doesn't have money
    await tellor.transfer(accounts[1].address,web3.utils.toWei("200"));
    await h.expectThrow(governance.proposeVote(accounts[2].address,0x3c46a185,newController.address,0));//require contract must be one in the system
    await h.expectThrow(governance.proposeVote(tellorMaster,0x3c46a222,newController.address,0));//require function must be approved
    await governance.proposeVote(tellorMaster,0x3c46a185,newController.address,0)
    let blocky = await ethers.provider.getBlock();
    let voteVars = await governance.getVoteInfo(1)
    let _hash = ethers.utils.solidityKeccak256(['address','bytes4','bytes','uint256'], [tellorMaster,0x3c46a185,newController.address,blocky.timestamp])
    assert(voteVars[0] == _hash, "identifier hash should be correct")
    assert(voteVars[1][0] == 1, "vote round should be 1")
    assert(voteVars[1][1] >= blocky.timestamp , "vote start date should be correct")
    assert(voteVars[1][2] > 0, "vote block number should be greater than 0")
    assert(voteVars[1][3] ==  web3.utils.toWei("10") , "fee should be correct")
    assert(voteVars[1][4] == 0, "tallyDate should be 0")
    assert(voteVars[4] - newController.address == 0, "vote data should be correct")
    assert(voteVars[5] == 0x3c46a185, "vote function should be correct")
    assert(voteVars[6][0] - tellorMaster == 0, "vote contract address should be correct")
    assert(voteVars[6][1] - accounts[1].address == 0, "vote initiator address should be correct")
    await h.advanceTime(86400 * 8)
    await governance.tallyVotes(1)
    await h.advanceTime(86400 * 3)
    await h.expectThrow(governance.proposeVote(tellorMaster,0x3c46a185,newController.address,blocky.timestamp))//require 1 day for new votes
    });
  it("tallyVotes()", async function() {
    await tellor.transfer(accounts[1].address,web3.utils.toWei("200"));
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
    await tellorUser.depositStake();
    oracle = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[1]);
    await oracle.submitValue(h.tob32("1"),300);
    let _t = await oracle.getReportTimestampByIndex(h.tob32("1"),0);
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[2]);
    teamGovernance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, devWallet);
    await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
    await governance.beginDispute(h.tob32("1"),_t);
    await teamGovernance.vote(1,true,false);
    await h.expectThrow(governance.tallyVotes(1));//time for voting hasn't elapsed
    await h.advanceTime(86400 * 2.5)
    await governance.tallyVotes(1)
    await h.expectThrow(governance.tallyVotes(1));//already tallied
    let voteVars = await governance.getVoteInfo(1)
    assert(voteVars[3] - 1 == 0, "result should be correct")
    assert(voteVars[1][4] > _t, "tally date should be correct")
    await h.advanceTime(86400 * 2.5)
    await governance.executeVote(1)
    h.expectThrow(governance.tallyVotes(1));//already executed
  });
  it("updateMinDisputeFee()", async function() {
    master= await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, govSigner);
    await master.changeUint(h.hash("_STAKE_COUNT"),1000)
    await governance.updateMinDisputeFee();
    assert(await governance.disputeFee() - h.to18(15) == 0, "Dispute Fee should be a minimum")
    await master.changeUint(h.hash("_STAKE_COUNT"),5)
    await governance.updateMinDisputeFee();
    assert(await governance.disputeFee() - web3.utils.toWei("97.5") == 0, "Dispute Fee should be close to maximum")
    await master.changeUint(h.hash("_STAKE_COUNT"),0)
    await governance.updateMinDisputeFee();
    assert(await governance.disputeFee() - await master.getUintVar(h.hash("_STAKE_AMOUNT")) == 0, "Dispute Fee should be stake")
  });
  it("verify()", async function() {
    assert(await governance.verify() > 9000, "Contract should properly verify")
  });
  it("vote()", async function() {
    let newController = await cfac.deploy();
    await newController.deployed();
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[2]);
    await governance.delegate(DEV_WALLET);
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[1]);
    await tellor.transfer(accounts[1].address,web3.utils.toWei("200"));
    await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
    await governance.proposeVote(tellorMaster,0x3c46a185,newController.address,0)
    await governance.vote(1,true,false);
    assert(await governance.didVote(1,accounts[1].address),"user should have voted")
    await h.expectThrow(governance.vote(1,true,false));//cannot vote if delegated
  });
  it("voteFor()", async function() {
    let newController = await cfac.deploy();
    await newController.deployed();
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[2]);
    await governance.delegate(DEV_WALLET);
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[1]);
    await governance.delegate(DEV_WALLET);
    await tellor.transfer(accounts[1].address,web3.utils.toWei("200"));
    await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
    for(i=3;i<=5;i++){
      await tellor.transfer(accounts[i].address,web3.utils.toWei("200"));
      governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[i]);
      await governance.delegate(DEV_WALLET);
    }
    await governance.proposeVote(tellorMaster,0x3c46a185,newController.address,0)
    await h.expectThrow(governance.vote(1,true,false));//cannot vote if delegated
    devGovernance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, devWallet);
    await devGovernance.voteFor([accounts[1].address],1,true,false);
    assert(await governance.didVote(1,accounts[1].address),"user should have voted")
    let myArr = [accounts[3].address,accounts[4].address,accounts[5].address]
    await devGovernance.voteFor(myArr,1,false,true)
    assert(await governance.didVote(1,accounts[3].address),"user3 should have voted")
    assert(await governance.didVote(1,accounts[4].address),"user4 should have voted")
    assert(await governance.didVote(1,accounts[5].address),"user5 should have voted")
  });
  it("_vote", async function() {
    await tellor.transfer(accounts[1].address,web3.utils.toWei("200"));
    await tellor.transfer(accounts[3].address,web3.utils.toWei("200"));
    await tellor.transfer(accounts[5].address,10);
    await tellor.transfer(accounts[6].address,web3.utils.toWei("100"));
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
    tellorUser6 = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[6]);
    await tellorUser.depositStake();
    await tellorUser6.depositStake()
    oracle = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[1]);
    oracle6 = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[6]);
    oracle5 = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[5]);
    await oracle5.addTip(ethers.utils.formatBytes32String("1"), 10)
    for(i=0;i<5;i++){
      await h.advanceTime(86400 * .6)
      await oracle6.submitValue( ethers.utils.formatBytes32String("3"),300);
    }
    await oracle.submitValue( ethers.utils.formatBytes32String("1"),300);
    let _t = await oracle.getReportTimestampByIndex(h.tob32("1"),0);
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[2]);
    governance3 = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[3]);
    governance4 = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[4]);
    governance5 = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[5]);
    governance6 = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[6]);
    governance1 = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[1]);
    await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
    h.expectThrow(governance.vote(1,true,false));//vote should exist
    await governance.beginDispute(h.tob32("1"),_t);
    await governance.vote(1,true,false); //weight is balance (200 TRB)
    await governance5.vote(1,true,true);//weight should be 5 (1/2 10 tip)
    await governance6.vote(1,false,false);//weight should be 100e18 (stake) + 5 mines
    h.expectThrow(governance.vote(1,true,false));//cannot vote twice
    h.expectThrow(governance1.vote(1,false,false));//cannot vote if disputed
    h.expectThrow(governance4.vote(1,false,false));//userbalance is zero
    assert(await governance.didVote(1,accounts[2].address),"user1 should have voted")
    assert(await governance.didVote(1,accounts[5].address),"user should have voted")
    assert(await governance.didVote(1,accounts[6].address),"user should have voted")
    await h.advanceTime(86400 * 2.5)
    await governance.tallyVotes(1)
    h.expectThrow(governance3.vote(1,false,false));//vote has been tallied
    let voteVars = await governance.getVoteInfo(1)
    assert(voteVars[1][5] - await tellor.balanceOf(accounts[2].address) == 0, "does Support should be account 2 balance")
    assert(voteVars[1][6] - h.to18(105) == 0, "against should be right")
    assert(voteVars[1][7] - 5 == 0, "invalidQuery should be right")
  });
  it("_min", async function() {
    assert(await governance.testMin(2,3) == 2, "minimum should be correct")
    assert(await governance.testMin(12,3) == 3, "minimum should be correct2")
  });
  it("getDelegateInfo()", async function() {
    governance = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",governance.address, accounts[2]);
    await governance.delegate(DEV_WALLET);
    await governance.delegate(accounts[1].address);
    let vars = await governance.getDelegateInfo(accounts[2].address)
    assert(vars[0] == accounts[1].address, "delegate should be correct")
    assert(vars[1] > 0, "block of delegation should be correct")
  });
  it("isFunctionApproved()", async function() {
      assert(await governance.isFunctionApproved(0xe8ce51d7) == true, "Function should be approved")
      assert(await governance.isFunctionApproved(0xe8ce5222) == false, "Function should not be approved")
  });
  it("getVoteRounds()", async function() {
    await tellor.transfer(accounts[1].address,web3.utils.toWei("200"));
    await tellor.transfer(accounts[2].address,web3.utils.toWei("2000"));
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
    await tellorUser.depositStake();
    oracle = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[1]);
    await oracle.submitValue(h.tob32("1"),300);
    let _t = await oracle.getReportTimestampByIndex(h.tob32("1"),0);
    governance = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",governance.address, accounts[2]);
    await governance.beginDispute(h.tob32("1"),_t);
    let _hash = ethers.utils.solidityKeccak256(['bytes32','uint256'], [h.tob32("1"),_t])
    await h.advanceTime(86400 * 2.5)
    await governance.tallyVotes(1)
    await tellor.transfer(accounts[3].address,web3.utils.toWei("100"));
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[3]);
    await tellorUser.depositStake();
    oracle = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[3]);
    await oracle.submitValue(h.tob32("2"),300);
    _t2 = await oracle.getReportTimestampByIndex(h.tob32("2"),0);
    await governance.beginDispute(h.tob32("2"),_t2);
    await governance.beginDispute(h.tob32("1"),_t);
    let vars = await governance.getVoteRounds(_hash);
    assert(vars[0] == 1, "voteround 1 is correct")
    assert(vars[1] == 3, "vote round 2 is correct")
  });
  it("getVoteInfo()", async function() {
    await tellor.transfer(accounts[1].address,web3.utils.toWei("100"));
    await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
    let newController = await cfac.deploy();
    await newController.deployed();
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[1]);
    governance2 = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[2]);
    await governance.proposeVote(tellorMaster,0x3c46a185,newController.address,0)
    let blocky = await ethers.provider.getBlock();
    await governance.vote(1,true,false)
    await governance2.vote(1,false,false)
    let voteVars = await governance.getVoteInfo(1)
    let _hash = ethers.utils.solidityKeccak256(['address','bytes4','bytes','uint256'], [tellorMaster,0x3c46a185,newController.address,blocky.timestamp])
    assert(voteVars[0] - _hash == 0, "identifier hash should be correct")
    assert(voteVars[1][0] == 1, "vote round should be 1")
    assert(voteVars[1][1] >= blocky.timestamp , "vote start date should be correct")
    assert(voteVars[1][2] > 0, "vote block number should be greater than 0")
    assert(voteVars[1][3] ==  web3.utils.toWei("10") , "fee should be correct")
    assert(voteVars[1][4] == 0, "tallyDate should be 0")
    assert(voteVars[1][5] - h.to18(90) == 0, "doesSupport should be 90")
    assert(voteVars[1][6] - h.to18(200) == 0, "against should be 0")
    assert(voteVars[1][7] == 0, "invalidQuery should be 0")
    assert(voteVars[2][0] == false, "vote not yet executed")
    assert(voteVars[2][1] == false, "vote is not dispute")
    assert(voteVars[3] == 0, "no result should be set")
    assert(voteVars[4] - newController.address == 0, "vote data should be correct")
    assert(voteVars[5] == 0x3c46a185, "vote function should be correct")
    assert(voteVars[6][0] - tellorMaster == 0, "vote contract address should be correct")
    assert(voteVars[6][1] - accounts[1].address == 0, "vote initiator address should be correct")
  });
  it("getDisputeInfo()", async function() {
        await tellor.transfer(accounts[1].address,web3.utils.toWei("200"));
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
    await tellorUser.depositStake();
    oracle = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[1]);
    await oracle.submitValue( ethers.utils.formatBytes32String("disputedVar"),300000);
    let _t = await oracle.getReportTimestampByIndex(h.tob32("disputedVar"),0);
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[2]);
    await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
    await governance.beginDispute(h.tob32("disputedVar"),_t);
    let dispVars = await governance.getDisputeInfo(1);
    assert(dispVars[0] - h.tob32("disputeVar") == 0, "requestId should be correct")
    assert(dispVars[1] - _t == 0, "timestamp should be correct")
    assert(dispVars[2] - 300000 == 0, "value should be correct")
    assert(dispVars[3] == accounts[1].address, "reported Miner should be correct")
  });
  it("getOpenDisputesOnId()", async function() {
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[2]);
    await tellor.transfer(accounts[2].address,web3.utils.toWei("2000"));
    for(i=1;i<=4;i++){
      await tellor.transfer(accounts[i].address,web3.utils.toWei("200"));
      tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[i]);
      await tellorUser.depositStake();
      oracle = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[i]);
      await oracle.submitValue( ethers.utils.formatBytes32String("disputedVar"),300000 + i);
      let _t = await oracle.getReportTimestampByIndex(h.tob32("disputedVar"),0);
      await governance.beginDispute(h.tob32("disputedVar"),_t);
    }  
    assert(await governance.getOpenDisputesOnId(h.tob32("disputedVar")) == 4, "number of open disputes should be right")
  });
  it("didVote()", async function() {
    await tellor.transfer(accounts[1].address,web3.utils.toWei("200"));
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
    await tellorUser.depositStake();
    oracle = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[1]);
    await oracle.submitValue( ethers.utils.formatBytes32String("disputedVar"),300000);
    let _t = await oracle.getReportTimestampByIndex(h.tob32("disputedVar"),0);
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[2]);
    await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
    await governance.beginDispute(h.tob32("disputedVar"),_t);
    await governance.vote(1,true,false)
    assert(await governance.didVote(1,accounts[2].address), "addresss should have voted")
  });
});