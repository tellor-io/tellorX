const { AbiCoder } = require("@ethersproject/abi");
const { expect } = require("chai");
const h = require("./helpers/helpers");
var assert = require('assert');
const web3 = require('web3');
const { ethers } = require("hardhat");
const { stakeAmount } = require("./helpers/helpers");
const { keccak256 } = require("ethers/lib/utils");

describe("End-to-End Tests - Two", function() {

  const tellorMaster = "0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0"
  const DEV_WALLET = "0x39E419bA25196794B595B2a595Ea8E527ddC9856"
  const PARACHUTE = "0x83eB2094072f6eD9F57d3F19f54820ee0BaE6084"
  const BIGWALLET = "0xf977814e90da44bfa03b6295a0616a897441acec";
  let accounts = null
  let tellor = null
  let cfac,ofac,tfac,gfac,parachute,govBig,govTeam,oracle
  let govSigner = null

  beforeEach("deploy and setup TellorX", async function() {
    this.timeout(20000000)
    accounts = await ethers.getSigners();
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [{forking: {
            jsonRpcUrl: hre.config.networks.hardhat.forking.url,
            blockNumber:13147399

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
  it("What happens if a staked miner is disputed twice? (maybe have window for disputes to prevent this?)", async function() {
    this.timeout(20000000)
    //create miner and two disputers
    let n = 42
    let [v1, reporter, disputer1, disputer2] = await ethers.getSigners()
    let requestId = keccak256("0x"+n.toString(16))
    let disputedValue = keccak256("0x"+n.toString(16))

    //mint miner tokens

    await tellor.connect(devWallet).transfer(reporter.address, BigInt(101E18))

    //mint disputers their dispute fees
    await tellor.connect(devWallet).transfer(disputer1.address, BigInt(200E18))

    await tellor.connect(devWallet).transfer(disputer2.address, BigInt(200E18))

    //mint voter big voting balance
    let devBalance = await tellor.balanceOf(DEV_WALLET)
    await tellor.connect(devWallet).transfer(v1.address, devBalance)


    //stake miner
    await tellor.connect(reporter).depositStake()


    //miner submits bad value
    await oracle.connect(reporter).submitValue(requestId, disputedValue, 0, ("0x"+n.toString(16)))
    let currentBlock = await ethers.provider.getBlock()
    let timestamp = currentBlock.timestamp

    //disputer opens dispute within 12 hours of submission
    await governance.connect(disputer1).beginDispute(requestId, timestamp)
    let voteCount = await governance.voteCount()
    //elapse time (a week forward) to

    await network.provider.send("evm_increaseTime", [3600 * 24 * 7]) //1 week
    await network.provider.send("evm_mine")
    //voter votes
    await governance.connect(v1).vote(voteCount, true, false)

    //tally votes
    await governance.tallyVotes(voteCount)

    //elapse time (a week forward) to
    await network.provider.send("evm_increaseTime", [3600 * 24 * 7]) //1 week
    await network.provider.send("evm_mine")
    //execute vote
    await governance.executeVote(voteCount)

    await expect(
      governance.connect(v1).vote(voteCount, true, false),
      "voter was able to vote on finished dispute"
    ).to.be.reverted
    //check vote data


    await expect(
        governance.connect(disputer1).beginDispute(requestId, timestamp),
        // "account disputed "
    ).to.be.reverted

    //pass time, everyone votes
    voteCount = await governance.voteCount()

    await expect(
      governance.connect(v1).vote(voteCount, true, false),
      "voter was able to vote on finished dispute"
    ).to.be.reverted

    // //tally votes
    // await tellor.tallyVotes(voteCount)

    // //execute vote
    // await tellor.executeVote(voteCount)



  });

  it("Upgrade Treasury Contract", async function() {

      //read current treasury address

      //deploy new treasury contract
      let tfac = await ethers.getContractFactory("contracts/Treasury.sol:Treasury");
      let treasury = await tfac.deploy()
      await treasury.deployed()

      //set up dummy voter accounts
      let [v1] = await ethers.getSigners()

      //mint tokens to dummy voters
      let devBalance = await tellor.balanceOf(DEV_WALLET)
      await tellor.connect(devWallet).transfer(v1.address, devBalance)
      await tellor.connect(govSigner).mint(v1.address, BigInt(1E6)*BigInt(1E18))


      //propose vote setup
      let f = await ethers.utils.keccak256(ethers.utils.toUtf8Bytes("changeTreasuryContract(address)"))
      let bytes4 = f.substring(0, 10)
      let currentBlock = await ethers.provider.getBlock()
      let timestamp = currentBlock.timestamp



      //propose vote
      await governance.connect(v1).proposeVote(
        tellor.address,
        bytes4,
        "0x000000000000000000000000" + treasury.address.slice(2),
        timestamp
      )

      let voteCount = await governance.voteCount()

      //dummy accounts vote
      await governance.connect(v1).vote(voteCount, true, false)

      //elapse time (a week forward) to
      await h.advanceTime(604800)

      //tally vote
      await governance.tallyVotes(voteCount)

      //elapse time (a week forward) to
      await h.advanceTime(1186400)

      //execute vote
      await governance.executeVote(voteCount)

      let treasuryAddress = await tellor.getAddressVars(h.hash("_TREASURY_CONTRACT"))
      expect(treasuryAddress).to.equal(treasury.address)
    })

    it("No votes during treasury duration", async function() {

      let treasuryAmount = BigInt(500E18)
      let treasuryRate = 0.05 * 10000
      let treasuryDuration = 3600 * 24 * 14 //14 days

      let treasuryBought = BigInt(10E18)

      let n = 42
      let requestId = keccak256("0x"+n.toString(16))
      let disputedValue = keccak256("0x"+n.toString(16))

      //create treasury buyer, reporter, disputer
      let [buyer, reporter, disputer] = await ethers.getSigners()

      //mint tokens for buyer
      await tellor.connect(devWallet).transfer(buyer.address, BigInt(101E18))

      //mint and stake reporter
      await tellor.connect(devWallet).transfer(reporter.address, BigInt(101E18))
      await tellor.connect(reporter).depositStake()

      //mint disputer
      await tellor.connect(devWallet).transfer(disputer.address, BigInt(200E18))

      //governance issues treasuries
      await treasury.connect(govSigner).issueTreasury(treasuryAmount, treasuryRate, treasuryDuration)
      let treasuryCount = treasury.getTreasuryCount()

      //buyer buys treasury
      await treasury.connect(buyer).buyTreasury(treasuryCount, treasuryBought)

      //reporter submits a value
      await oracle.connect(reporter).submitValue(requestId, disputedValue, 0, ("0x"+n.toString(16)))
      let currentBlock = await ethers.provider.getBlock()
      let timestamp = currentBlock.timestamp

      //disputer disputes value
      await governance.connect(disputer).beginDispute(requestId, timestamp)
      let voteCount = await governance.voteCount()


      //user doesn't vote
      await h.advanceTime(86400 * 7) //7 days

      //tally vote
      await governance.tallyVotes(voteCount)

      await h.advanceTime(86400*7) //7 days

      //execute vote
      await governance.executeVote(voteCount)

      //vote should have invalid outcome
      let voteInfo = await governance.getVoteInfo(voteCount)
      let voteResult = voteInfo[3]
      let invalid = 2

      expect(voteResult).to.equal(invalid, "no one voted, outcome wasn't 'invalid'")

      //fast forward to treasury expiration
      await h.advanceTime(86400)

      //pay treasury
      let oldBalance = Number(await tellor.balanceOf(buyer.address))

      await treasury.connect(buyer).payTreasury(buyer.address, treasuryCount)

      let newBalance = Number(await tellor.balanceOf(buyer.address))


      //expect no treasury rewards because buyer didnt vote
      expect(newBalance - oldBalance).to.equal(Number(treasuryBought))

    })

    it("Decrease reporter lock time", async function() {

      let oldReportingLock
      let newReportingLock = 60*60
      let reportingStake = BigInt(100E18)

      let n = 42
      let requestId = keccak256("0x"+n.toString(16))
      let disputedValue = keccak256("0x"+n.toString(16))

      //create reporter
      let [reporter] = await ethers.getSigners()

      //mint reporter staking tokens
      await tellor.connect(devWallet).transfer(reporter.address, reportingStake)

      //stake reporter
      await tellor.connect(reporter).depositStake()

      // read current reporting lock
      oldReportingLock = await oracle.getReportingLock()

      expect(oldReportingLock).to.equal(60*60*12)

      //miner submits

      await oracle.connect(reporter).submitValue(requestId, disputedValue, 0, ("0x"+n.toString(16)))


      //decrease reporting lock to 1 hour
      await oracle.connect(govSigner).changeReportingLock(newReportingLock)
      expect(await oracle.reportingLock()).to.equal(newReportingLock)

      //expect the reporting lock still works
      await expect(
        oracle.connect(reporter).submitValue(requestId, disputedValue, 1, ("0x"+n.toString(16))),
        "reporting lock stopped working"
      ).to.be.reverted

      //expect they can submit after 1 hour now, not 12
      await h.advanceTime(60*60)


      //reporter submits value
      await oracle.connect(reporter).submitValue(requestId, disputedValue, 1, ("0x"+n.toString(16)))


    })

    // it("Test dispute on old contract, then dispute on new contract", async function() {

    // })
});
