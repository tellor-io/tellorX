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
    let accounts = null
    let tellor = null
    let cfac,ofac,tfac,gfac
    let govSigner = null
    let devWallet
  
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
  it("What happens if a staked miner is disputed twice? (maybe have window for disputes to prevent this?)", async function() {
    
    //create miner and two disputers
    let n = 42
    let [v1, reporter, disputer1, disputer2] = await ethers.getSigners()
    let requestId = keccak256("0x"+n.toString(16))
    let disputedValue = keccak256("0x"+n.toString(16))

    //mint miner tokens
    console.log(1)
    await tellor.connect(devWallet).transfer(reporter.address, BigInt(100E18))
    console.log(2)
    //mint disputers their dispute fees
    await tellor.connect(devWallet).transfer(disputer1.address, BigInt(200E18))
    console.log(3)
    await tellor.connect(devWallet).transfer(disputer2.address, BigInt(200E18))
    console.log(4)
    //mint voter big voting balance
    let devBalance = await tellor.balanceOf(DEV_WALLET)
    await tellor.connect(devWallet).transfer(v1.address, devBalance)

    console.log(5)
    //stake miner
    await tellor.connect(reporter).depositStake()

    console.log(6)
    //miner submits bad value
    await oracle.connect(reporter).submitValue(requestId, disputedValue)
    let currentBlock = await ethers.provider.getBlock()
    let timestamp = currentBlock.timestamp
    console.log(7)
    //disputer opens dispute within 12 hours of submission
    await governance.connect(disputer1).beginDispute(requestId, timestamp)
    let voteCount = await governance.voteCount()
    //elapse time (a week forward) to 
    await network.provider.send("evm_increaseTime", [3600 * 24 * 7]) //1 week
    await network.provider.send("evm_mine")
    //voter votes
    expect(
      await governance.connect(v1).vote(voteCount, true, false),
      "voter was able to vote on finished dispute"
    )
    //tally votes
    await governance.tallyVotes(voteCount)
    console.log(8)
    //execute vote
    await governance.executeVote(voteCount)
    // await expect(
    await    governance.connect(disputer1).beginDispute(requestId, timestamp),
        // "account disputed "
        // ).to.be.reverted
    console.log(9)
    //pass time, everyone votes
    voteCount = await governance.voteCount()
    console.log(10)
    expect(
      await governance.connect(v1).vote(voteCount, true, false),
      "voter was able to vote on finished dispute"
    )
    console.log(11)
    //tally votes
    await tellor.tallyVotes(voteCount)

    //execute vote
    await tellor.executeVote(voteCount)



  });

  it("Upgrade Treasury Contract", async function() {

      //deploy new treasury contract
      let tfac = await ethers.getContractFactory("contracts/Treasury.sol:Treasury");
      let treasury = await tfac.deploy()
      await treasury.deployed()

      //set up dummy voter accounts
      let [v1] = await ethers.getSigners()

      //mint tokens to dummy voters
      let devBalance = await tellor.balanceOf(DEV_WALLET)
      await tellor.connect(devWallet).transfer(v1.address, devBalance)
      await tellor.connect(devWallet).mint(v1.address, 200000)

      //propose vote setup
      let f = await ethers.utils.keccak256(ethers.utils.toUtf8Bytes("changeTreasuryContract(address)"))
      let bytes4 = f.substring(0, 10)
      let currentBlock = await ethers.provider.getBlock()
      let timestamp = currentBlock.timestamp
      console.log(timestamp)
      console.log(4)

      //propose vote
      await governance.connect(v1).proposeVote(
        tellor.address,
        bytes4,
        treasury.address,
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

      let voteVars = await governance.getVoteInfo(voteCount)

      console.log(treasury.address)
      console.log(voteVars[3])
      console.log(voteVars[4])
    })
});
