const { AbiCoder } = require("@ethersproject/abi");
const { expect } = require("chai");
const h = require("./helpers/helpers");
var assert = require('assert');
const web3 = require('web3');
const { ethers } = require("hardhat");
const { stakeAmount } = require("./helpers/helpers");
const { keccak256 } = require("ethers/lib/utils");

describe("End-to-End Tests - Seven", function() {

  const tellorMaster = "0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0"
  const DEV_WALLET = "0x39E419bA25196794B595B2a595Ea8E527ddC9856"
  const PARACHUTE = "0x83eB2094072f6eD9F57d3F19f54820ee0BaE6084"
  const BIGWALLET = "0xf977814e90da44bfa03b6295a0616a897441acec";
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
            jsonRpcUrl: hre.config.networks.hardhat.forking.url,
            blockNumber:13147682

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
    gfac = await ethers.getContractFactory("contracts/testing/TestGovernance.sol:TestGovernance");
    ofac = await ethers.getContractFactory("contracts/Oracle.sol:Oracle");
    tfac = await ethers.getContractFactory("contracts/Treasury.sol:Treasury");
    cfac = await ethers.getContractFactory("contracts/testing/TestController.sol:TestController");
    governance = await gfac.deploy();
    oracle = await ofac.deploy();
    treasury = await tfac.deploy();
    controller = await cfac.deploy(governance.address, oracle.address, treasury.address);
    await governance.deployed();
    await oracle.deployed();
    await treasury.deployed();
    await controller.deployed();
    await accounts[0].sendTransaction({to:DEV_WALLET,value:ethers.utils.parseEther("1.0")});
    devWallet = await ethers.provider.getSigner(DEV_WALLET);
    bigWallet = await ethers.provider.getSigner(BIGWALLET);
    master = await oldTellorInstance.connect(devWallet)
    await master.proposeFork(controller.address);
    let _id = await master.getUintVar(h.hash("_DISPUTE_COUNT"))
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
    await accounts[1].sendTransaction({to:governance.address,value:ethers.utils.parseEther("1.0")});
    govSigner = await ethers.provider.getSigner(governance.address);
    });
  it("Make sure correct value is removed after multiple disputes on an id", async function() {
    this.timeout(20000000)
    await tellor.transfer(accounts[1].address,web3.utils.toWei("100"));
    await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
    await tellorUser.depositStake();
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[2]);
    await tellorUser.depositStake();
    oracle2 = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[2]);
    await oracle2.submitValue( h.uintTob32(2),150,0,'0x');//clear inflationary rewards
    await h.advanceTime(86400)
    oracle = await ethers.getContractAt("contracts/Oracle.sol:Oracle",oracle.address, accounts[1]);
    await oracle.submitValue( h.uintTob32(1),50,0,'0x');
    await oracle2.submitValue( h.uintTob32(1),100,1,'0x');
    let blocky1 = await ethers.provider.getBlock();
    await h.advanceTime(86400)
    assert(await oracle.getTimestampIndexByTimestamp(h.uintTob32(1),blocky1.timestamp) == 1, "index should be correct")
    await oracle.submitValue( h.uintTob32(1),200,2,'0x');
    let blocky2 = await ethers.provider.getBlock();
    await oracle2.submitValue( h.uintTob32(1),300,3,'0x');
    let blocky3 = await ethers.provider.getBlock();
    await h.advanceTime(86400)
    await oracle.submitValue( h.uintTob32(1),400,4,'0x');
    await oracle2.submitValue( h.uintTob32(1),500,5,'0x');
    let blocky4 = await ethers.provider.getBlock();
    assert(await oracle.getTimestampIndexByTimestamp(h.uintTob32(1),blocky3.timestamp) == 3, "index should be correct");
    admin = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, govSigner);
    await admin.removeValue( h.uintTob32(1),blocky1.timestamp);
    assert(await oracle.getTimestampIndexByTimestamp(h.uintTob32(1),blocky3.timestamp) == 2, "index should be correct");
    assert(await oracle.getTimestampIndexByTimestamp(h.uintTob32(1),blocky4.timestamp) == 4, "index should be correct");
    await admin.removeValue( h.uintTob32(1),blocky2.timestamp);
    assert(await oracle.getTimestampIndexByTimestamp(h.uintTob32(1),blocky2.timestamp) == 0, "index should be correct");
    assert(await oracle.getTimestampIndexByTimestamp(h.uintTob32(1),blocky3.timestamp) == 1, "index should be correct");
    assert(await oracle.getValueByTimestamp(h.uintTob32(1),blocky1.timestamp) == "0x", "value should be correct");
    assert(await oracle.getValueByTimestamp(h.uintTob32(1),blocky2.timestamp) == "0x", "value should be correct");
    assert(await oracle.getValueByTimestamp(h.uintTob32(1),blocky3.timestamp) - 300 == 0, "value should be correct");
    assert(await oracle.getValueByTimestamp(h.uintTob32(1),blocky4.timestamp) - 500 == 0, "value should be correct");
  });

  it("Add fully realistic test (actual variables we'll use and two treasuries and mining and a dispute)", async function() {
    await tellor.transfer(accounts[1].address,web3.utils.toWei("300"));
    await tellor.transfer(accounts[2].address,web3.utils.toWei("300"));
    await tellor.transfer(accounts[3].address,web3.utils.toWei("120"));
    await tellor.transfer(oracle.address,web3.utils.toWei("200"));
    let voteCount;
    await tellor.connect(accounts[1]).depositStake();
    await tellor.connect(accounts[2]).depositStake();
    nonce = await oracle.getTimestampCountById(h.uintTob32(1));
    await oracle.connect(accounts[1]).submitValue(h.uintTob32(1),300,nonce,'0x');
    await h.advanceTime(300);
    nonce = await oracle.getTimestampCountById(h.uintTob32(2));
    await oracle.connect(accounts[2]).submitValue(h.uintTob32(2),500,nonce,'0x');
    await h.advanceTime(60*60);
    // Propose issue treasury 1
    await governance.connect(accounts[3]).proposeVote(treasury.address, 0x6274885f, "0x00000000000000000000000000000000000000000000000ad78ebc5ac620000000000000000000000000000000000000000000000000000000000000000001f40000000000000000000000000000000000000000000000000000000000278d00", 0);
    voteCount = await governance.voteCount();
    await govTeam.vote(voteCount,true,false);
    await govBig.vote(voteCount,true,false);
    await h.advanceTime(604800);
    nonce = await oracle.getTimestampCountById(h.uintTob32(1));
    await oracle.connect(accounts[1]).submitValue(h.uintTob32(1),300,nonce,'0x');
    await h.advanceTime(300);
    nonce = await oracle.getTimestampCountById(h.uintTob32(2));
    await oracle.connect(accounts[2]).submitValue(h.uintTob32(2),500,nonce,'0x');
    await governance.connect(accounts[3]).tallyVotes(voteCount);
    await h.advanceTime(86400);
    nonce = await oracle.getTimestampCountById(h.uintTob32(1));
    await oracle.connect(accounts[1]).submitValue(h.uintTob32(1),300,nonce,'0x');
    await h.advanceTime(300);
    nonce = await oracle.getTimestampCountById(h.uintTob32(2));
    await oracle.connect(accounts[2]).submitValue(h.uintTob32(2),500,nonce,'0x');
    await governance.executeVote(voteCount);
    await treasury.connect(accounts[1]).buyTreasury(1,web3.utils.toWei("100"));
    await treasury.connect(accounts[2]).buyTreasury(1,web3.utils.toWei("100"));
    await h.advanceTime(43200);
    nonce = await oracle.getTimestampCountById(h.uintTob32(1));
    await oracle.connect(accounts[1]).submitValue(h.uintTob32(1),300,nonce,'0x');
    await h.advanceTime(300);
    nonce = await oracle.getTimestampCountById(h.uintTob32(2));
    await oracle.connect(accounts[2]).submitValue(h.uintTob32(2),500,nonce,'0x');
    // Propose issue treasury 2
    await governance.connect(accounts[3]).proposeVote(treasury.address, 0x6274885f, "0x00000000000000000000000000000000000000000000000ad78ebc5ac620000000000000000000000000000000000000000000000000000000000000000001f40000000000000000000000000000000000000000000000000000000000278d00", 0);
    voteCount = await governance.voteCount();
    await govTeam.vote(voteCount,true,false);
    await govBig.vote(voteCount,true,false);
    await governance.connect(accounts[1]).vote(voteCount,true,false);
    await governance.connect(accounts[2]).vote(voteCount,true,false);
    await h.advanceTime(604800);
    nonce = await oracle.getTimestampCountById(h.uintTob32(1));
    await oracle.connect(accounts[1]).submitValue(h.uintTob32(1),300,nonce,'0x');
    await h.advanceTime(300);
    nonce = await oracle.getTimestampCountById(h.uintTob32(2));
    await oracle.connect(accounts[2]).submitValue(h.uintTob32(2),500,nonce,'0x');
    await governance.connect(accounts[3]).tallyVotes(voteCount);
    await h.advanceTime(86400);
    nonce = await oracle.getTimestampCountById(h.uintTob32(1));
    await oracle.connect(accounts[1]).submitValue(h.uintTob32(1),1000,nonce,'0x');
    let blocky = await ethers.provider.getBlock();
    await h.advanceTime(300);
    nonce = await oracle.getTimestampCountById(h.uintTob32(2));
    await oracle.connect(accounts[2]).submitValue(h.uintTob32(2),500,nonce,'0x');
    await governance.executeVote(voteCount);
    await treasury.connect(accounts[1]).buyTreasury(2,web3.utils.toWei("100"));
    await treasury.connect(accounts[2]).buyTreasury(2,web3.utils.toWei("100"));
    // Dispute miner accounts[1]
    await governance.connect(accounts[3]).beginDispute(h.uintTob32(1),blocky.timestamp);
    voteCount = await governance.voteCount();
    await govTeam.vote(voteCount,true,false);
    await govBig.vote(voteCount,true,false);
    h.expectThrow(governance.connect(accounts[1]).vote(voteCount,true,false));//disputed miner can't vote
    await governance.connect(accounts[2]).vote(voteCount,true,false);
    await h.advanceTime(604800);
    nonce = await oracle.getTimestampCountById(h.uintTob32(1));
    h.expectThrow(oracle.connect(accounts[1]).submitValue(h.uintTob32(1),300,nonce,'0x'));//disputed miner can't submit vals
    nonce = await oracle.getTimestampCountById(h.uintTob32(2));
    await oracle.connect(accounts[2]).submitValue(h.uintTob32(2),500,nonce,'0x');
    let disputeInfo = await governance.getDisputeInfo(voteCount);
    await governance.connect(accounts[3]).tallyVotes(voteCount);
    await h.advanceTime(86400);
    await governance.executeVote(voteCount);
    // Pay treasuries
    await h.advanceTime(2592000);
    let balBefore1 = await tellor.balanceOf(accounts[1].address);
    let balBefore2 = await tellor.balanceOf(accounts[2].address);
    await treasury.connect(accounts[1]).payTreasury(accounts[1].address,1);
    await treasury.connect(accounts[2]).payTreasury(accounts[2].address,1);
    let balAfter1 = await tellor.balanceOf(accounts[1].address);
    let balAfter2 = await tellor.balanceOf(accounts[2].address);
    let balDiff1 = balAfter1.sub(balBefore1);
    let balDiff2 = balAfter2.sub(balBefore2);
    let treasAmount = ethers.BigNumber.from(web3.utils.toWei("100"));
    let expectedBal1 = treasAmount.mul(500).div(10000).mul(1).div(2).add(treasAmount);
    let expectedBal2 = treasAmount.mul(500).div(10000).add(treasAmount);
    assert(balDiff1.eq(expectedBal1), "Treasury investor 1 balance should be correct");
    assert(balDiff2.eq(expectedBal2), "Treasury investor 2 balance should be correct");
    nonce = await oracle.getTimestampCountById(h.uintTob32(1));
    await h.expectThrow(oracle.connect(accounts[1]).submitValue(h.uintTob32(1),300,nonce,'0x'));//kicked miner can't submit vals
    nonce = await oracle.getTimestampCountById(h.uintTob32(2));
    await oracle.connect(accounts[2]).submitValue(h.uintTob32(2),500,nonce,'0x');
  });

  it("Approve a new random function and run it (e.g. transfer on token)", async function() {
    await tellor.transfer(accounts[1].address,web3.utils.toWei("30"));
    let voteCount;
    await governance.connect(accounts[1]).proposeVote(governance.address,0xe48d4b3b, "0xa9059cbb000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001",1);
    voteCount = await governance.voteCount();
    await governance.connect(accounts[1]).vote(voteCount, true, false);
    await govBig.vote(voteCount, true, false);
    await govTeam.vote(voteCount, true, false);
    await h.advanceTime(604800);
    await governance.connect(accounts[1]).tallyVotes(voteCount);
    await h.advanceTime(86400);
    await governance.executeVote(voteCount);
    assert(await governance.isFunctionApproved(0xa9059cbb), "Transfer function should be approved");
    await tellor.transfer(governance.address,web3.utils.toWei("100"));
    await governance.connect(accounts[1]).proposeVote(tellor.address,0xa9059cbb,"0x000000000000000000000000b9dd5afd86547df817da2d0fb89334a6f8edd8910000000000000000000000000000000000000000000000056bc75e2d63100000",1);
    voteCount = await governance.voteCount();
    await governance.connect(accounts[1]).vote(voteCount, true, false);
    await govBig.vote(voteCount, true, false);
    await govTeam.vote(voteCount, true, false);
    await h.advanceTime(604800);
    await governance.connect(accounts[1]).tallyVotes(voteCount);
    await h.advanceTime(86400);
    let userBal1 = await tellor.balanceOf(accounts[2].address);
    let govBal1 = await tellor.balanceOf(governance.address);
    await governance.executeVote(voteCount);
    let userBal2 = await tellor.balanceOf(accounts[2].address);
    let govBal2 = await tellor.balanceOf(governance.address);
    assert(userBal2.sub(userBal1) == web3.utils.toWei("100"), "User balance should be correct");
    assert(govBal1.sub(govBal2) == web3.utils.toWei("100"), "Governance contract balance should be correct");
  });

  it("Ensure can't call tally vote for unused dispute id", async function() {
    await h.expectThrow(governance.connect(accounts[1]).tallyVotes(5)) // can't tally vote on unused id
    await h.expectThrow(governance.connect(accounts[1]).tallyVotes(9999999999999)) // can't tally vote on unused id
  })

});
