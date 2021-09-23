const { AbiCoder } = require("@ethersproject/abi");
const { expect } = require("chai");
const h = require("./helpers/helpers");
var assert = require('assert');
const web3 = require('web3');
const { ethers } = require("hardhat");
const { stakeAmount } = require("./helpers/helpers");
const { keccak256 } = require("ethers/lib/utils");

describe("End-to-End Tests - Six", function() {

  const tellorMaster = "0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0"
  const DEV_WALLET = "0x39E419bA25196794B595B2a595Ea8E527ddC9856"
  const PARACHUTE = "0x83eB2094072f6eD9F57d3F19f54820ee0BaE6084"
  const BIGWALLET = "0xf977814e90da44bfa03b6295a0616a897441acec";
  let accounts = null
  let tellor = null
  let cfac,ofac,tfac,gfac,parachute,govBig,govTeam,oracle, oldTellorInstance
  let govSigner = null
  let disputeHash, badMiner, timestamp, d1

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
    controller = await cfac.deploy();
    await governance.deployed();
    await oracle.deployed();
    await treasury.deployed();
    await controller.deployed();
    await accounts[0].sendTransaction({to:DEV_WALLET,value:ethers.utils.parseEther("1.0")});
    devWallet = await ethers.provider.getSigner(DEV_WALLET);
    bigWallet = await ethers.provider.getSigner(BIGWALLET);
    master = await oldTellorInstance.connect(devWallet)
    await master.depositStake()

    /**
     *
     *
     * BEGIN SETUP MODIFICATION
     */

    d1 = accounts[5]
    //fund disputer
    await oldTellorInstance.connect(devWallet).transfer(d1.address, BigInt(500E18))
    let valueCount = await oldTellorInstance.getNewValueCountbyRequestId(1)
    valueCount--
    timestamp = await oldTellorInstance.getTimestampbyRequestIDandIndex(1, valueCount)
    await oldTellorInstance.connect(d1).beginDispute(1, timestamp, 1)
    let badMiners = await oldTellorInstance.getMinersByRequestIdAndTimestamp(1,timestamp)
    badMiner = badMiners[1]
    disputeHash = ethers.utils.solidityKeccak256(['address','uint256','uint256'], [badMiners[1],1,timestamp])

    /**
     *
     * END SETUP MODIFICATION
     */

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
    await tellor.init(governance.address,oracle.address,treasury.address)
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [governance.address]}
    )
    await accounts[1].sendTransaction({to:governance.address,value:ethers.utils.parseEther("1.0")});
    govSigner = await ethers.provider.getSigner(governance.address);
    });

    it("Test dispute on old contract, then dispute on new contract", async function() {

        let disputeId = await tellor.getDisputeIdByDisputeHash(disputeHash)
        assert(disputeId > 0, "Should return non-zero dispute id")
        let tellorToOld = await ethers.getContractAt("contracts/tellor3/ITellor.sol:ITellor",tellorMaster, devWallet)
        await tellorToOld.vote(disputeId,true)
        await tellorToOld.connect(bigWallet).vote(disputeId,true)
        await h.advanceTime(86400 * 8)
        await tellorToOld.tallyVotes(disputeId)
        await h.advanceTime(86400 * 2.5)
        let oldDisputeVars = await tellorToOld.connect(bigWallet).getAllDisputeVars(disputeId);
        assert(oldDisputeVars[1], "Old tellor dispute should be executed")
        assert(oldDisputeVars[2], "Old tellor dispute should have passed")
        let disputerBal1 = await tellor.balanceOf(d1.address)
        await tellorToOld.unlockDisputeFee(disputeId)
        let disputerBal2 = await tellor.balanceOf(d1.address)
        assert(disputerBal2-disputerBal1 > 0, "Disputer should be paid reward for successful dispute")

        // Dispute on new contract
        await tellor.connect(bigWallet).transfer(accounts[1].address, web3.utils.toWei("100"))
        await tellor.connect(accounts[1]).depositStake()
        await oracle.connect(accounts[1]).submitValue(h.tob32("1"),300,0)
        let blocky2 = await ethers.provider.getBlock();
        let timestamp2 = blocky2.timestamp;
        await govBig.beginDispute(h.tob32("1"),timestamp2)
        voteCount = await governance.voteCount()
        await govTeam.vote(voteCount,true,false)
        await govBig.vote(voteCount,true,false)
        h.expectThrow(governance.connect(accounts[1]).vote(voteCount,true,false));//disputed miner can't vote
        await h.advanceTime(604800)
        await governance.connect(accounts[3]).tallyVotes(voteCount)
        await h.advanceTime(86400)
        assert(await tellor.balanceOf(accounts[1].address) == web3.utils.toWei("100"), "Disputed reporter balance should be correct")
        await governance.executeVote(voteCount)
        let voteInfo = await governance.getVoteInfo(voteCount)
        assert(voteInfo[2][0] == true, "Vote should be executed")
        assert(voteInfo[3] == 1, "Vote result should be correct")
        assert(await tellor.balanceOf(accounts[1].address) == 0, "Disputed reporter balance should be correct")
    })
});
