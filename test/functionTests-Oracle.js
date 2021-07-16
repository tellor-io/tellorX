// const { AbiCoder } = require("@ethersproject/abi");
// const { expect } = require("chai");
// const h = require("./helpers/helpers");
// var assert = require('assert');
// const web3 = require('web3');
// const { Console } = require("console");

// describe("TellorX Function Tests - Oracle", function() {

//     const tellorMaster = "0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0"
//     const DEV_WALLET = "0x39E419bA25196794B595B2a595Ea8E527ddC9856"
//     let accounts = null
//     let tellor = null
//     let cfac,ofac,tfac,gfac,devWallet
//     let govSigner = null
  
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
//     cfac = await ethers.getContractFactory("contracts/Controller.sol:Controller");
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
//   it("addTip()", async function() {
//     var ts = await tellor.totalSupply()
//     oracle1 = await ethers.getContractAt("contracts/Oracle.sol:Oracle",oracle.address, accounts[1]);
//     h.expectThrow(oracle1.addTip(ethers.utils.formatBytes32String("1"),2));//must have funds
//     await tellor.transfer(accounts[1].address,web3.utils.toWei("200"))
//     h.expectThrow(oracle1.addTip(ethers.utils.formatBytes32String("1"),0));//tip must be greater than 0
//     oracle1.addTip(ethers.utils.formatBytes32String("1"),web3.utils.toWei("100"))
//     assert(await oracle.getTipsByUser(accounts[1].address) == web3.utils.toWei("50"), "tips by user should be correct")
//     assert(await oracle.getTipsById(ethers.utils.formatBytes32String("1")) == web3.utils.toWei("50"), "tips by ID should be correct")
//     assert(await oracle.tipsInContract() == web3.utils.toWei("50"), "tips in contract should be correct")
//     var ts2 = await tellor.totalSupply()
//     assert(ts - ts2  - web3.utils.toWei("50") < 100000000, "half of tip should be burned")//should be close enough (rounding errors)
//   });
//   it("submitValue()", async function() {
//     await tellor.transfer(accounts[1].address,web3.utils.toWei("100"));
//     await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
//     await tellor.transfer(oracle.address,web3.utils.toWei("200"));//funding the oracle for inflationary rewards
//     tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
//     await h.expectThrow(oracle.submitValue( ethers.utils.formatBytes32String("1"),150));//must be staked
//     await tellorUser.depositStake();
//     tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[2]);
//     await tellorUser.depositStake();
//     oracle2 = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[2]);
//     await oracle2.submitValue( ethers.utils.formatBytes32String("2"),150);//clear inflationary rewards
//     oracle = await ethers.getContractAt("contracts/Oracle.sol:Oracle",oracle.address, accounts[1]);
//     await oracle2.addTip(ethers.utils.formatBytes32String("1"),web3.utils.toWei("10"))
//     let initBal = await tellor.balanceOf(accounts[1].address)
//     await oracle.submitValue( ethers.utils.formatBytes32String("1"),150);
//     let blocky = await ethers.provider.getBlock();
//     await h.expectThrow(oracle.submitValue( ethers.utils.formatBytes32String("1"),150));//cannot submit twice in 12 hours
//     assert(await oracle.getValueByTimestamp(ethers.utils.formatBytes32String("1"),blocky.timestamp) - 150 == 0, "value should be correct")
//     assert(await oracle.tipsInContract() == 0, "the tip should have been paid out")
//     assert(await oracle.getTipsById(ethers.utils.formatBytes32String("1")) == 0, "tips should be zeroed")
//     assert(await oracle.getTimestampIndexByTimestamp(ethers.utils.formatBytes32String("1"),blocky.timestamp) == 0, "index should be correct")
//     assert(await oracle.getReportTimestampByIndex(ethers.utils.formatBytes32String("1"),0) == blocky.timestamp, "timestamp should be correct")
//     assert(await oracle.getTimestampCountById(ethers.utils.formatBytes32String("1")) - 1 == 0, "timestamp count should be correct")
//     assert(await oracle.getReportsSubmittedByAddress(accounts[1].address) - 1 == 0, "reports by address should be correct")
//     assert(await oracle.timeOfLastNewValue()- blocky.timestamp == 0, "timeof last new value should be correct")
//     assert(await tellor.balanceOf(accounts[1].address) - initBal - web3.utils.toWei("5") > 0, "reporter should be paid")
//     assert(await tellor.balanceOf(accounts[1].address) - initBal - web3.utils.toWei("5.01") < 0, "reporter should be paid")
//     assert(await oracle.getReporterByTimestamp(ethers.utils.formatBytes32String("1"),blocky.timestamp) == accounts[1].address, "reporter should be correct")
//     assert(await oracle.getBlockNumberByTimestamp(ethers.utils.formatBytes32String("1"),blocky.timestamp) - blocky.number == 0, "blockNumber should be correct")
//     await h.advanceTime(86400)
//     admin = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, govSigner);
//     //increase stake amount, ensure failed until they put in more
//     await admin.changeUint(h.hash("_STAKE_AMOUNT"),web3.utils.toWei("150"))
//     await h.expectThrow(oracle.submitValue( ethers.utils.formatBytes32String("1"),150));//balance must be greater than stake amount
//     await tellor.transfer(accounts[1].address,web3.utils.toWei("100"));
//     oracle.submitValue(ethers.utils.formatBytes32String("1"),150)
// });
//   it("removeValue()", async function() {
//     await tellor.transfer(accounts[1].address,web3.utils.toWei("100"));
//     tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
//     await tellorUser.depositStake();
//     oracle = await ethers.getContractAt("contracts/Oracle.sol:Oracle",oracle.address, accounts[1]);
//     await oracle.submitValue( ethers.utils.formatBytes32String("1"),150);
//     let blocky = await ethers.provider.getBlock();
//     await h.expectThrow(oracle.removeValue( ethers.utils.formatBytes32String("1"),blocky.timestamp));//must be governance
//     admin = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, govSigner);
//     await admin.removeValue( ethers.utils.formatBytes32String("1"),blocky.timestamp)
//     assert(await oracle.getTimestampCountById(ethers.utils.formatBytes32String("1"))  == 0, "timestamp count should be correct")
//     assert(await oracle.getTimestampIndexByTimestamp(ethers.utils.formatBytes32String("1"),blocky.timestamp) == 0, "index should be correct")
//     assert(await oracle.getValueByTimestamp(ethers.utils.formatBytes32String("1"),blocky.timestamp) == "0x", "value should be correct")
//   });
//   it("verify()", async function() {
//     assert(await oracle.verify() > 9000, "Contract should properly verify")
//   });
//   it("changeMiningLock()", async function() {
//     admin = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, govSigner);
//     await admin.changeMiningLock(86400)
//     assert(await oracle.miningLock() - 86400 == 0, "mining lock should be changed")
//   });
//   it("getTipsById()", async function() {
//     await tellor.transfer(accounts[1].address,web3.utils.toWei("100"));
//     oracle = await ethers.getContractAt("contracts/Oracle.sol:Oracle",oracle.address, accounts[1]);
//     await oracle.addTip(ethers.utils.formatBytes32String("1"),500)
//     await oracle.addTip(ethers.utils.formatBytes32String("1"),500)
//     assert(await oracle.getTipsById(ethers.utils.formatBytes32String("1")) - 500 == 0, "tips should be correct")
//   });
//   it("getTimestampCountById()", async function() {
//     await tellor.transfer(accounts[1].address,web3.utils.toWei("100"));
//     await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
//     tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
//     await tellorUser.depositStake();
//     tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[2]);
//     await tellorUser.depositStake();
//     oracle2 = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[2]);
//     await oracle2.submitValue( ethers.utils.formatBytes32String("2"),150);//clear inflationary rewards
//     await h.advanceTime(86400)
//     oracle = await ethers.getContractAt("contracts/Oracle.sol:Oracle",oracle.address, accounts[1]);
//     await oracle.submitValue( ethers.utils.formatBytes32String("1"),150);
//     await oracle2.submitValue( ethers.utils.formatBytes32String("1"),150);
//     assert(await oracle.getTimestampCountById(ethers.utils.formatBytes32String("1")) - 2== 0, "timestamp count should be correct")
//   });
//   it("getTimestampIndexByTimestamp()", async function() {
//     await tellor.transfer(accounts[1].address,web3.utils.toWei("100"));
//     await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
//     tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
//     await tellorUser.depositStake();
//     tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[2]);
//     await tellorUser.depositStake();
//     oracle2 = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[2]);
//     await oracle2.submitValue( ethers.utils.formatBytes32String("2"),150);//clear inflationary rewards
//     await h.advanceTime(86400)
//     oracle = await ethers.getContractAt("contracts/Oracle.sol:Oracle",oracle.address, accounts[1]);
//     await oracle.submitValue( ethers.utils.formatBytes32String("1"),150);
//     await oracle2.submitValue( ethers.utils.formatBytes32String("1"),150);
//     let blocky = await ethers.provider.getBlock();
//     assert(await oracle.getTimestampIndexByTimestamp(ethers.utils.formatBytes32String("1"),blocky.timestamp) == 1, "index should be correct")
//   });
//   it("getReportTimestampByIndex()", async function() {
//     await tellor.transfer(accounts[1].address,web3.utils.toWei("100"));
//     await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
//     tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
//     await tellorUser.depositStake();
//     tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[2]);
//     await tellorUser.depositStake();
//     oracle2 = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[2]);
//     await oracle2.submitValue( ethers.utils.formatBytes32String("2"),150);//clear inflationary rewards
//     await h.advanceTime(86400)
//     oracle = await ethers.getContractAt("contracts/Oracle.sol:Oracle",oracle.address, accounts[1]);
//     await oracle.submitValue( ethers.utils.formatBytes32String("1"),150);
//     await oracle2.submitValue( ethers.utils.formatBytes32String("1"),150);
//     let blocky = await ethers.provider.getBlock();
//     assert(await oracle.getReportTimestampByIndex(ethers.utils.formatBytes32String("1"),1) == blocky.timestamp, "timestamp should be correct")
    
//   });
//   it("getReportsSubmittedByAddress()", async function() {
//     await tellor.transfer(accounts[1].address,web3.utils.toWei("100"));
//     await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
//     tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
//     await tellorUser.depositStake();
//     tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[2]);
//     await tellorUser.depositStake();
//     oracle2 = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[2]);
//     await oracle2.submitValue( ethers.utils.formatBytes32String("2"),150);//clear inflationary rewards
//     oracle = await ethers.getContractAt("contracts/Oracle.sol:Oracle",oracle.address, accounts[1]);
//     await oracle.submitValue( ethers.utils.formatBytes32String("1"),150);
//     await h.advanceTime(86400)
//     await oracle.submitValue( ethers.utils.formatBytes32String("1"),150);
//     await h.advanceTime(86400)
//     await oracle.submitValue( ethers.utils.formatBytes32String("1"),150);
//     await h.advanceTime(86400)
//     await oracle.submitValue( ethers.utils.formatBytes32String("1"),150);
//     let blocky = await ethers.provider.getBlock();
//     assert(await oracle.getReportsSubmittedByAddress(accounts[1].address) - 4 == 0, "reports by address should be correct")
//   });
//   it("getTipsByUser()", async function() {
//     await tellor.transfer(accounts[1].address,web3.utils.toWei("100"));
//     oracle = await ethers.getContractAt("contracts/Oracle.sol:Oracle",oracle.address, accounts[1]);
//     await oracle.addTip(ethers.utils.formatBytes32String("1"),500)
//     await oracle.addTip(ethers.utils.formatBytes32String("1"),500)
//     assert(await oracle.getTipsByUser(accounts[1].address) - 500 == 0, "tips should be correct")
//   });
//   it("getValueByTimestamp()", async function() {
//     await tellor.transfer(accounts[1].address,web3.utils.toWei("100"));
//     await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
//     tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
//     await tellorUser.depositStake();
//     tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[2]);
//     await tellorUser.depositStake();
//     oracle2 = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[2]);
//     oracle = await ethers.getContractAt("contracts/Oracle.sol:Oracle",oracle.address, accounts[1]);
//     await oracle.submitValue( ethers.utils.formatBytes32String("1"),5550);
//     let blocky = await ethers.provider.getBlock();
//     await oracle2.submitValue( ethers.utils.formatBytes32String("1"),150);
//     assert(await oracle.getValueByTimestamp(ethers.utils.formatBytes32String("1"),blocky.timestamp) - 5550 == 0, "value should be correct")
//   });
//   it("getBlockNumberByTimestamp()", async function() {
//     await tellor.transfer(accounts[1].address,web3.utils.toWei("100"));
//     await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
//     tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
//     await tellorUser.depositStake();
//     tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[2]);
//     await tellorUser.depositStake();
//     oracle2 = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[2]);
//     await oracle2.submitValue( ethers.utils.formatBytes32String("2"),150);//clear inflationary rewards
//     await h.advanceTime(86400)
//     oracle = await ethers.getContractAt("contracts/Oracle.sol:Oracle",oracle.address, accounts[1]);
//     await oracle.submitValue( ethers.utils.formatBytes32String("1"),5550);
//     let blocky = await ethers.provider.getBlock();
//     await oracle2.submitValue( ethers.utils.formatBytes32String("1"),150);
//     assert(await oracle.getBlockNumberByTimestamp(ethers.utils.formatBytes32String("1"),blocky.timestamp) - blocky.number == 0, "blockNumber should be correct")
//   });
//   it("getReporterByTimestamp()", async function() {
//     await tellor.transfer(accounts[1].address,web3.utils.toWei("100"));
//     await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
//     tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
//     await tellorUser.depositStake();
//     tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[2]);
//     await tellorUser.depositStake();
//     oracle2 = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[2]);
//     oracle = await ethers.getContractAt("contracts/Oracle.sol:Oracle",oracle.address, accounts[1]);
//     await oracle.submitValue( ethers.utils.formatBytes32String("1"),5550);
//     let blocky = await ethers.provider.getBlock();
//     await oracle2.submitValue( ethers.utils.formatBytes32String("1"),150);
//     let blocky2 = await ethers.provider.getBlock();
//     assert(await oracle.getReporterByTimestamp(ethers.utils.formatBytes32String("1"),blocky.timestamp) == accounts[1].address, "reporter should be correct")
//     assert(await oracle.getReporterByTimestamp(ethers.utils.formatBytes32String("1"),blocky2.timestamp) == accounts[2].address, "reporter2 should be correct")
//   });
// });