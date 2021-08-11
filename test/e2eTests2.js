// const { AbiCoder } = require("@ethersproject/abi");
// const { expect } = require("chai");
// const h = require("./helpers/helpers");
// var assert = require('assert');
// const web3 = require('web3');
// const { ethers } = require("hardhat");
// const { stakeAmount } = require("./helpers/helpers");
// const { keccak256 } = require("ethers/lib/utils");

// describe("End-to-End Tests - Two", function() {

//     const tellorMaster = "0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0"
//     const DEV_WALLET = "0x39E419bA25196794B595B2a595Ea8E527ddC9856"
//     let accounts = null
//     let tellor = null
//     let cfac,ofac,tfac,gfac
//     let govSigner = null
//     let devWallet
  
//   beforeEach("deploy and setup TellorX", async function() {
//     accounts = await ethers.getSigners();
//     await hre.network.provider.request({
//       method: "hardhat_reset",
//       params: [{forking: {
//             jsonRpcUrl: hre.config.networks.hardhat.forking.url,
//             blockNumber:12762660
//           },},],
//       });
//     await hre.network.provider.request({
//       method: "hardhat_impersonateAccount",
//       params: [DEV_WALLET]}
//     )
//         //Steps to Deploy:
//         //Deploy Governance, Oracle, Treasury, and Controller. 
//         //Fork mainnet Ethereum, changeTellorContract to Controller
//         //run init in Controller

//     oldTellorInstance = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor", tellorMaster)
//     gfac = await ethers.getContractFactory("contracts/testing/TestGovernance.sol:TestGovernance");
//     ofac = await ethers.getContractFactory("contracts/Oracle.sol:Oracle");
//     tfac = await ethers.getContractFactory("contracts/Treasury.sol:Treasury");
//     cfac = await ethers.getContractFactory("contracts/testing/TestController.sol:TestController");
//     governance = await gfac.deploy();
//     oracle = await ofac.deploy();
//     treasury = await tfac.deploy();
//     controller = await cfac.deploy();
//     await governance.deployed();
//     await oracle.deployed();
//     await treasury.deployed();
//     await controller.deployed();
//     await accounts[0].sendTransaction({to:DEV_WALLET,value:ethers.utils.parseEther("1.0")});
//     devWallet = await ethers.provider.getSigner(DEV_WALLET);
//     master = await oldTellorInstance.connect(devWallet)
//     await master.changeTellorContract(controller.address);
//     tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, devWallet);
//     await tellor.deployed();
//     await tellor.init(governance.address,oracle.address,treasury.address)
//     await hre.network.provider.request({
//       method: "hardhat_impersonateAccount",
//       params: [governance.address]}
//     )
//     await accounts[1].sendTransaction({to:governance.address,value:ethers.utils.parseEther("1.0")});
//     govSigner = await ethers.provider.getSigner(governance.address);
//   });
//   it("What happens if a staked miner is disputed twice? (maybe have window for disputes to prevent this?)", async function() {
    
//     //create miner and two disputers
//     let n = 42
//     let [reporter, disputer1, disputer2] = await ethers.getSigners()
//     let voters = [v1, v2, v3, v4, v5, v6] = await ethers.getSigners()
//     let requestId = keccak256("0x"+n.toString(16))
//     let disputedValue = keccak256("0x"+n.toString(16))

//     //mint miner tokens
//     let currentBlock = await ethers.provider.getBlockNumber()
//     let timestamp = await ethers.provider.getBlock(currentBlock).timestamp
//     console.log(1)
//     await tellor.connect(devWallet).transfer(reporter.address, BigInt(100E18))
//     console.log(2)
//     //mint disputers their dispute fees
//     await tellor.connect(devWallet).transfer(disputer1.address, BigInt(15E18))
//     console.log(3)
//     await tellor.connect(devWallet).transfer(disputer2.address, BigInt(15E18))
//     console.log(4)


//     //stake miner
//     await tellor.connect(reporter).depositStake()

//     //miner submits bad value
//     await tellor.connect(reporter).submitValue(requestId, disputedValue)

//     //disputer opens dispute within 12 hours of submission
//     await tellor.connect(disputer1).beginDispute(requestId, timestamp)

//     //second disputer can't open up dispute on
//     //an open vote for a disputed requestId+timestamp+reporter
//     //for 12 hours after vote is opened
//     await network.provider.send("evm_increaseTime", [3600 * 6]) //6 hours
//     await network.provider.send("evm_mine")
//     await expect(
//         tellor.connect(disputer2).beginDispute(requestId, timestamp + 3600 * 6),
//         "2nd disputer opened up new vote on same dispute"
//         ).to.be.reverted

//     //pass time, everyone votes
//     let voteCount = await tellor.voteCount()
//     for (i = 0; i < voters.length; i++) {
//         await tellor.connect(voters[i]).vote(voteCount, true, false)
//     }

//     //tally votes
//     await tellor.tallyVotes(voteCount)

//     //execute vote
//     await tellor.executeVote(voteCount)


//     //expect second account cannot open second dispute after disputer wins
//     //because the miner lost their stake
//     expect(await tellor.balanceOf(reporter.address)).to.equal(0)
//     await expect(
//         tellor.connect(disputer2).beginDispute(requestId, timestamp),
//         "second disputer re-opened vote on dispute that won"
//     )

//   });

//   it("Upgrade Treasury Contract", async function() {

//       //deploy new treasury contract

//       //set up dummy voter accounts
//       let voters = [v1, v2, v3, v4, v5, v6] = await ethers.getSigners()

//       //mint tokens to dummy voters
//       for (i = 0; i < voters.length; i++) {
//         await tellor.connect(devWallet).transfer(voters[i].address, BigInt(100E18))
//       }

//       //propose vote

//       //dummy accounts vote

//       //tally vote

//       //execute vote
//   })
// });
