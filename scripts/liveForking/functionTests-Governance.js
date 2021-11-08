const { AbiCoder } = require("@ethersproject/abi");
const { expect } = require("chai");
const h = require("../../test/helpers/helpers");
var assert = require('assert');
const web3 = require('web3');
const fetch = require('node-fetch')

// Hardhat forking tests for after TellorX is deployed, before init called

describe("TellorX Function Tests - Governance", function() {

  const tellorMaster = "0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0"
  const controllerAddress = "0x45b778325ECf22E317767028a50749ff1D41E30b"
  const oracleAddress = "0xD7b3529A008d1791Ea683b6Ac909ecE309603C12"
  const governanceAddress = "0x8Db04961e0f87dE557aCB92f97d90e2A2840A468"
  const treasuryAddress = "0x2fcAb47708fcE3713fD4420A0dDD5270b5b92632"
  const DEV_WALLET = "0x2F51C4Bf6B66634187214A695be6CDd344d4e9d1"
  const PARACHUTE = "0x83eB2094072f6eD9F57d3F19f54820ee0BaE6084"
  const BIGWALLET = "0x41C5a04F61b865e084E5F502ff322aD624CaD609";
  const FORK_DISPUTE_ID = 10;
  let accounts = null
  let tellor = null
  let cfac,ofac,tfac,gfac,parachute,govBig,govTeam
  let govSigner = null

  beforeEach("deploy and setup TellorX", async function() {
    this.timeout(20000000)
    accounts = await ethers.getSigners();
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [{forking: {
            // jsonRpcUrl: hre.config.networks.hardhat.forking.url,
            jsonRpcUrl: "https://eth-rinkeby.alchemyapi.io/v2/I-BlqR7R6s5-Skel3lnCwJzamDbmXHLF",
            blockNumber:9607000
          },},],
      });
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [DEV_WALLET]}
    )
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [PARACHUTE]}
    )
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [BIGWALLET]}
    )
        //Steps to Deploy:
        //Deploy Governance, Oracle, Treasury, and Controller.
        //Fork mainnet Ethereum, changeTellorContract to Controller
        //run init in Controller

    oldTellorInstance = await ethers.getContractAt("contracts/tellor3/ITellor.sol:ITellor", tellorMaster)
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance", governanceAddress)
    oracle = await ethers.getContractAt("contracts/Oracle.sol:Oracle", oracleAddress)
    treasury = await ethers.getContractAt("contracts/Treasury.sol:Treasury", treasuryAddress)
    controller = await ethers.getContractAt("contracts/Controller.sol:Controller", controllerAddress)
    gfac = await ethers.getContractFactory("contracts/testing/TestGovernance.sol:TestGovernance");
    ofac = await ethers.getContractFactory("contracts/Oracle.sol:Oracle");
    tfac = await ethers.getContractFactory("contracts/Treasury.sol:Treasury");
    cfac = await ethers.getContractFactory("contracts/testing/TestController.sol:TestController");
    sendfac = await ethers.getContractFactory("contracts/testing/ForceSendEther.sol:ForceSendEther");
    forceSend = await sendfac.deploy();
    await forceSend.deployed();
    await accounts[0].sendTransaction({to:DEV_WALLET,value:ethers.utils.parseEther("1.0")});
    devWallet = await ethers.provider.getSigner(DEV_WALLET);
    bigWallet = await ethers.provider.getSigner(BIGWALLET);
    master = await oldTellorInstance.connect(devWallet)
    // await master.proposeFork(controller.address);
    // let _id = await master.getUintVar(h.hash("_DISPUTE_COUNT"))
    let _id = FORK_DISPUTE_ID
    await master.vote(_id,true)
    master = await oldTellorInstance.connect(bigWallet)
    await master.vote(_id,true);
    await h.advanceTime(86400 * 8)
    await master.tallyVotes(_id)
    await h.advanceTime(86400 * 2.5)
    await master.updateTellor(_id)
    tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, devWallet);
    parachute = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",PARACHUTE, devWallet);
    govTeam = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",governance.address, devWallet);
    govBig = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",governance.address, bigWallet);
    await tellor.deployed();
    await tellor.init()
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [governance.address]}
    )
    await accounts[1].sendTransaction({to:forceSend.address,value:ethers.utils.parseEther("1.0")});
    await forceSend.forceSendEther(governance.address);
    govSigner = await ethers.provider.getSigner(governance.address);
    });
  it("constructor()", async function() {
    this.timeout(20000000)
    let initFuncs = [0x3c46a185,0xe8ce51d7,0x1cbd3151,0xbd87e0c9, 0x740358e6,
      0x40c10f19,0xe48d4b3b,0x5d183cfa,0x6274885f];
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
    await oracle.submitValue( h.uintTob32(1),300,0,'0x');
    let _t = await oracle.getReportTimestampByIndex(h.uintTob32(1),0);
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[2]);
    h.expectThrow(governance.beginDispute(h.uintTob32(1),_t + 86400));//not a valid timestamp
    h.expectThrow(governance.beginDispute(h.uintTob32(1),_t + 86400));//no tokens to pay fee
    await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
    let _stakers0 = await tellor.getUintVar(h.hash("_STAKE_COUNT"))
    await governance.beginDispute(h.uintTob32(1),_t);
    let _stakers1 = await tellor.getUintVar(h.hash("_STAKE_COUNT"))
    let _hash = ethers.utils.solidityKeccak256(['bytes32','uint256'], [h.uintTob32(1),_t])
    let voteVars = await governance.getVoteInfo(1)
    assert(_stakers0 - _stakers1 == 1, "_STAKE_COUNT should be correct")
    assert(voteVars[0] == _hash, "identifier hash should be correct")
    assert(voteVars[1][0] == 1, "vote round should be 1")
    assert(voteVars[1][1] >= _t , "vote start date should be correct")
    assert(voteVars[1][2] > 0, "vote block number should be greater than 0")
    let _fee = web3.utils.toWei("100") - (web3.utils.toWei("100") - web3.utils.toWei("10")) * _stakers0/web3.utils.toBN("200")
    assert(voteVars[1][3] ==  _fee * 9/10, "fee should be correct")
    assert(voteVars[1][4] == 0, "tallyDate should be 0")
    assert(voteVars[2][1], "should be a dispute")
    assert(voteVars[6][1] == accounts[2].address, "initiator should be correct")
    let dispVars = await governance.getDisputeInfo(1);
    assert(dispVars[0] == h.uintTob32(1), "requestId should be correct")
    assert(dispVars[1] - _t == 0, "timestamp should be correct")
    assert(dispVars[2] - 300 == 0, "value should be correct")
    assert(dispVars[3] == accounts[1].address, "reported Miner should be correct")
    assert(await governance.getOpenDisputesOnId(h.uintTob32(1)) == 1, "number of disputes open on ID should be correct")
    assert(await oracle.getValueByTimestamp(h.uintTob32(1),_t) == "0x", "value should be removed")
    assert(await oracle.getTipsById(h.uintTob32(1)) -.1 * _fee/2 == 0, "tip should have been added")
    let _stakerInfo = await tellor.getStakerInfo(accounts[1].address) ;
    assert(_stakerInfo[0] - 3 ==0, "miner should be disputed")
    await h.advanceTime(86400 * 2.5)
    await governance.tallyVotes(1)
    await tellor.transfer(accounts[3].address,web3.utils.toWei("200"));
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[3]);
    await tellorUser.depositStake();
    oracle = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[3]);
    await oracle.submitValue(h.uintTob32(2),301,0,'0x');
    let _t2 = oracle.getReportTimestampByIndex(h.uintTob32(2),0);
    await h.advanceTime(86400+1000)
    h.expectThrow(governance.beginDispute(h.uintTob32(1),_t))//cannot open a new round past a day
    h.expectThrow(governance.beginDispute(h.uintTob32(2),_t2))// must dispute withing 12 hours
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
    await oracle.submitValue(h.uintTob32(1),300,0,'0x');
    let initBalReporter = await tellor.balanceOf(accounts[1].address)
    let initBalDisputer = await tellor.balanceOf(accounts[2].address)
    let _t = await oracle.getReportTimestampByIndex(h.uintTob32(1),0);
    governance = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",governance.address, accounts[2]);
    devGovernance = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",governance.address, devWallet);
    await governance.beginDispute(h.uintTob32(1),_t);
    await devGovernance.vote(1,true,false)
    let _hash = ethers.utils.solidityKeccak256(['bytes32','uint256'], [h.uintTob32(1),_t])
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
    let val1 = finalBalDisputer.sub(initBalDisputer)
    let val2 = await tellor.getUintVar(h.hash("_STAKE_AMOUNT"))*1 - (voteVars[1][3]*10/9 - voteVars[1][3])
    assert(val1 - val2 == 0)
    // assert(finalBalDisputer - initBalDisputer - (await tellor.getUintVar(h.hash("_STAKE_AMOUNT"))*1 - (voteVars[1][3]*10/9 - voteVars[1][3])) == 0)
    assert(initBalReporter - finalBalReporter - await tellor.getUintVar(h.hash("_STAKE_AMOUNT")) == 0)
    await tellor.transfer(accounts[3].address,web3.utils.toWei("200"));
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[3]);
    await tellorUser.depositStake();
    oracle = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[3]);
    await oracle.submitValue(h.uintTob32(2),300,0,'0x');
    _t = await oracle.getReportTimestampByIndex(h.uintTob32(2),0);
    stakeCount0 = await tellor.getUintVar(h.hash("_STAKE_COUNT"))
    await governance.beginDispute(h.uintTob32(2),_t);
    stakeCount1 = await tellor.getUintVar(h.hash("_STAKE_COUNT"))
    assert(stakeCount0 - stakeCount1 == 1, "_STAKE_COUNT should be correct")
    await h.advanceTime(86400 * 3)
    await governance.tallyVotes(2)
    await governance.beginDispute(h.uintTob32(2),_t);
    assert(stakeCount0 - stakeCount1 == 1, "_STAKE_COUNT should be correct")
    await h.expectThrow(governance.executeVote(2));//must be the final vote
    await h.advanceTime(86400 * 3)
    await governance.tallyVotes(3)
    h.expectThrow(governance.executeVote(2));//must be the final vote
    await h.advanceTime(86400 * 2.5)
    stakeCount0 = await tellor.getUintVar(h.hash("_STAKE_COUNT"))
    await governance.executeVote(3)
    stakeCount1 = await tellor.getUintVar(h.hash("_STAKE_COUNT"))
    assert(voteVars[2][0] == true, "vote should be executed")
    assert(stakeCount1 - stakeCount0 == 1, "_STAKE_COUNT should be correct")
  });
  it("proposeVote()", async function() {
    let newController = await cfac.deploy(governance.address, oracle.address, treasury.address);
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
    await oracle.submitValue(h.uintTob32(1),300,0,'0x');
    let _t = await oracle.getReportTimestampByIndex(h.uintTob32(1),0);
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[2]);
    teamGovernance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, devWallet);
    await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
    await governance.beginDispute(h.uintTob32(1),_t);
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
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[2]);
    master= await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, govSigner);
    await master.changeUint(h.hash("_STAKE_COUNT"),1000)
    await governance.updateMinDisputeFee();
    assert(await governance.disputeFee() - h.to18(10) == 0, "Dispute Fee should be a minimum")
    await master.changeUint(h.hash("_STAKE_COUNT"),5)
    await governance.updateMinDisputeFee();
    assert(await governance.disputeFee() - web3.utils.toWei("97.75") == 0, "Dispute Fee should be close to maximum")
    await master.changeUint(h.hash("_STAKE_COUNT"),0)
    await governance.updateMinDisputeFee();
    assert(await governance.disputeFee() - await master.getUintVar(h.hash("_STAKE_AMOUNT")) == 0, "Dispute Fee should be stake")
  });
  it("verify()", async function() {
    assert(await governance.verify() > 9000, "Contract should properly verify")
  });
  it("vote()", async function() {
    let newController = await cfac.deploy(governance.address, oracle.address, treasury.address);
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
    let newController = await cfac.deploy(governance.address, oracle.address, treasury.address);
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
    await oracle5.tipQuery(h.uintTob32(1), 10,'0x')
    for(i=0;i<5;i++){
      await h.advanceTime(86400 * .6)
      nonce = await oracle.getTimestampCountById(h.uintTob32(3));
      await oracle6.submitValue( h.uintTob32(3),300,nonce,'0x');
    }
    await oracle.submitValue( h.uintTob32(1),300,0,'0x');
    let userBal6 = await tellor.balanceOf(accounts[6].address)
    let _t = await oracle.getReportTimestampByIndex(h.uintTob32(1),0);
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[2]);
    governance3 = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[3]);
    governance4 = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[4]);
    governance5 = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[5]);
    governance6 = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[6]);
    governance1 = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[1]);
    await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
    h.expectThrow(governance.vote(1,true,false));//vote should exist
    await governance.beginDispute(h.uintTob32(1),_t);
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
    // assert(voteVars[1][6] - h.to18(105) == 0, "against should be right")
    assert(voteVars[1][6].eq(userBal6.add(web3.utils.toWei("5"))), "against should be right")
    assert(voteVars[1][7] - 5 == 0, "invalidQuery should be right")
    await oracle6.submitValue( h.uintTob32(44),30110,0,'0x');
    _t = await oracle.getReportTimestampByIndex(h.uintTob32(44),0);
    treasury = await ethers.getContractAt("contracts/Treasury.sol:Treasury",treasury.address, accounts[7]);
    admintreasury = await ethers.getContractAt("contracts/Treasury.sol:Treasury",treasury.address, govSigner);
    admin = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, govSigner);
    await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
    await admin.mint(accounts[7].address,web3.utils.toWei("500"))
    await admintreasury.issueTreasury(web3.utils.toWei("1000"),10,86400*100);
    await treasury.buyTreasury(1,web3.utils.toWei("500"))
    await governance.beginDispute(h.uintTob32(44),_t);
    governance7= await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[7]);
    await governance7.vote(2,true,false);//500 in treasury purchased
    voteVars = await governance.getVoteInfo(2)
    assert(await tellor.balanceOf(accounts[7].address) == 0, "should have no actual TRB balance")
    assert(voteVars[1][5] - web3.utils.toWei("500")== 0, "vote changes properly with treasury input")
  });
  it("getDelegateInfo()", async function() {
    governance = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",governance.address, accounts[2]);
    await governance.delegate(DEV_WALLET);
    await governance.delegate(accounts[1].address);
    let vars = await governance.getDelegateInfo(accounts[2].address)
    assert(vars[0] == accounts[1].address, "delegate should be correct")
    assert(vars[1] > 0, "block of delegation should be correct")
    vars = await governance.getDelegateInfo(accounts[3].address)
    assert(vars[0] == "0x0000000000000000000000000000000000000000", "delegate should be correct")
    assert(vars[1] == 0, "block of delegation should be correct")
  });
  it("isFunctionApproved()", async function() {
      assert(await governance.isFunctionApproved(0xe8ce51d7) == true, "Function should be approved")
      assert(await governance.isFunctionApproved(0xe8ce5222) == false, "Function should not be approved")
  });
  it("isApprovedGovernanceContract", async function() {
    governance = await ethers.getContractAt("contracts/interfaces/IGovernance.sol:IGovernance",governance.address, accounts[2]);
    let vars = await governance.isApprovedGovernanceContract(governance.address);
    assert(vars == true, "Address is an approved governance contract")
    vars = await governance.isApprovedGovernanceContract(accounts[1].address)
    assert(vars == false, "Address is not an approved governance contract")
});
  it("getVoteCount()", async function() {
  await tellor.transfer(accounts[1].address,web3.utils.toWei("200"));
  await tellor.transfer(accounts[2].address,web3.utils.toWei("2000"));
  tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
  await tellorUser.depositStake();
  oracle = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[1]);
  await oracle.submitValue(h.uintTob32(1),300,0,'0x');
  let _t = await oracle.getReportTimestampByIndex(h.uintTob32(1),0);
  governance = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",governance.address, accounts[2]);
  await governance.beginDispute(h.uintTob32(1),_t);
  let _hash = ethers.utils.solidityKeccak256(['bytes32','uint256'], [h.uintTob32(1),_t])
  await h.advanceTime(86400 * 2.5)
  await governance.tallyVotes(1)
  await tellor.transfer(accounts[3].address,web3.utils.toWei("100"));
  tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[3]);
  await tellorUser.depositStake();
  oracle = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[3]);
  await oracle.submitValue(h.uintTob32(2),300,0,'0x');
  _t2 = await oracle.getReportTimestampByIndex(h.uintTob32(2),0);
  await governance.beginDispute(h.uintTob32(2),_t2);
  await governance.beginDispute(h.uintTob32(1),_t);
  assert(await governance.getVoteCount()== 3,"vote count should be correct")
});
  it("getVoteRounds()", async function() {
    await tellor.transfer(accounts[1].address,web3.utils.toWei("200"));
    await tellor.transfer(accounts[2].address,web3.utils.toWei("2000"));
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
    await tellorUser.depositStake();
    oracle = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[1]);
    await oracle.submitValue(h.uintTob32(1),300,0,'0x');
    let _t = await oracle.getReportTimestampByIndex(h.uintTob32(1),0);
    governance = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",governance.address, accounts[2]);
    await governance.beginDispute(h.uintTob32(1),_t);
    let _hash = ethers.utils.solidityKeccak256(['bytes32','uint256'], [h.uintTob32(1),_t])
    await h.advanceTime(86400 * 2.5)
    await governance.tallyVotes(1)
    await tellor.transfer(accounts[3].address,web3.utils.toWei("100"));
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[3]);
    await tellorUser.depositStake();
    oracle = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[3]);
    await oracle.submitValue(h.uintTob32(2),300,0,'0x');
    _t2 = await oracle.getReportTimestampByIndex(h.uintTob32(2),0);
    await governance.beginDispute(h.uintTob32(2),_t2);
    await governance.beginDispute(h.uintTob32(1),_t);
    let vars = await governance.getVoteRounds(_hash);
    assert(vars[0] == 1, "voteround 1 is correct")
    assert(vars[1] == 3, "vote round 2 is correct")
  });
  it("getVoteInfo()", async function() {
    await tellor.transfer(accounts[1].address,web3.utils.toWei("100"));
    await tellor.transfer(accounts[3].address,web3.utils.toWei("200"));
    let newController = await cfac.deploy(governance.address, oracle.address, treasury.address);
    await newController.deployed();
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[1]);
    governance3 = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[3]);
    await governance.proposeVote(tellorMaster,0x3c46a185,newController.address,0)
    let blocky = await ethers.provider.getBlock();
    await governance.vote(1,true,false)
    await governance3.vote(1,false,false)
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
    await oracle.submitValue( h.uintTob32(50),300000,0,'0x');
    let _t = await oracle.getReportTimestampByIndex(h.uintTob32(50),0);
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[2]);
    await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
    await governance.beginDispute(h.uintTob32(50),_t);
    let dispVars = await governance.getDisputeInfo(1);
    assert(dispVars[0] - h.uintTob32(50) == 0, "requestId should be correct")
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
      await oracle.submitValue( h.uintTob32(50),300000 + i,0,'0x');
      let _t = await oracle.getReportTimestampByIndex(h.uintTob32(50),0);
      await governance.beginDispute(h.uintTob32(50),_t);
    }
    assert(await governance.getOpenDisputesOnId(h.uintTob32(50)) == 4, "number of open disputes should be right")
  });
  it("didVote()", async function() {
    await tellor.transfer(accounts[1].address,web3.utils.toWei("200"));
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
    await tellorUser.depositStake();
    oracle = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[1]);
    await oracle.submitValue( h.uintTob32(50),300000,0,'0x');
    let _t = await oracle.getReportTimestampByIndex(h.uintTob32(50),0);
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[2]);
    await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
    await governance.beginDispute(h.uintTob32(50),_t);
    await governance.vote(1,true,false)
    assert(await governance.didVote(1,accounts[2].address), "addresss should have voted")
  });
});
