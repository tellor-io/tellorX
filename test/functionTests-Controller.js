// const { AbiCoder } = require("@ethersproject/abi");
// const { expect } = require("chai");
// const h = require("./helpers/helpers");
// var assert = require('assert');

// describe("TellorX Function Tests - Controller", function() {

//     const tellorMaster = "0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0"
//     const DEV_WALLET = "0x39E419bA25196794B595B2a595Ea8E527ddC9856"
//     let accounts = null
//     let tellor = null
//     let cfac,ofac,tfac,gfac
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
//     const devWallet = await ethers.provider.getSigner(DEV_WALLET);
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
//   it("Transition.sol - init()", async function() {
//     assert(await tellor.getAddressVars(h.hash("_GOVERNANCE_CONTRACT")) == governance.address, "Governance Address should be correct");
//     assert(await tellor.getAddressVars(h.hash("_TREASURY_CONTRACT")) == treasury.address, "Governance Address should be correct");
//     assert(await tellor.getAddressVars(h.hash("_ORACLE_CONTRACT")) == oracle.address, "Governance Address should be correct");
//     assert(await tellor.getUintVar(h.hash("_STAKE_AMOUNT")) - h.to18(100) == 0, "stake amount should peroperly change");
//     h.expectThrow(tellor.init(oracle.address,oracle.address,oracle.address))
//     newController = await cfac.deploy();
//     await master.changeTellorContract(newController.address);
//     tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[0]);
//     h.expectThrow(tellor.init(oracle.address,oracle.address,oracle.address));
//   });
//   it("changeControllerContract()", async function() {
//     newController = await cfac.deploy();
//     await newController.deployed();
//     tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[0]);
//     h.expectThrow(tellor.changeControllerContract(newController.address));//should fail, onlygovernance
//     tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, govSigner);
//     h.expectThrow(tellor.changeControllerContract(accounts[3].address));//require isValid
//     await tellor.changeControllerContract(newController.address)
//     assert(await tellor.getAddressVars(h.hash("_TELLOR_CONTRACT")) == newController.address, "Controller Address should be correct");
//   });
//   it("changeGovernanceContract()", async function() {
//     newGovernance = await gfac.deploy();
//     await newGovernance.deployed();
//     tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[0]);
//     h.expectThrow(tellor.changeGovernanceContract(newGovernance.address));//should fail, onlygovernance
//     tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, govSigner);
//     h.expectThrow(tellor.changeGovernanceContract(accounts[3].address));//require isValid
//     await tellor.changeGovernanceContract(newGovernance.address)
//     assert(await tellor.getAddressVars(h.hash("_GOVERNANCE_CONTRACT")) == newGovernance.address, "Governance Address should be correct");
//   });
//   it("changeOracleContract()", async function() {
//     newOracle = await ofac.deploy();
//     await newOracle.deployed();
//     tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[0]);
//     h.expectThrow(tellor.changeOracleContract(newOracle.address));//should fail, onlygovernance
//     tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, govSigner);
//     h.expectThrow(tellor.changeOracleContract(accounts[3].address));//require isValid
//     await tellor.changeOracleContract(newOracle.address)
//     assert(await tellor.getAddressVars(h.hash("_ORACLE_CONTRACT")) == newOracle.address, "Governance Address should be correct");
//   });
//   it("changeTreasuryContract()", async function() {
//     newTreasury = await tfac.deploy();
//     await newTreasury.deployed();
//     tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[0]);
//     h.expectThrow(tellor.changeTreasuryContract(newTreasury.address));//should fail, onlygovernance
//     tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, govSigner);
//     h.expectThrow(tellor.changeTreasuryContract(accounts[3].address));//require isValid
//     await tellor.changeTreasuryContract(newTreasury.address)
//     assert(await tellor.getAddressVars(h.hash("_TREASURY_CONTRACT")) == newTreasury.address, "Governance Address should be correct");
//   });
//   it("changeUint()", async function() {
//     tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[0]);
//     h.expectThrow(tellor.changeUint(h.hash("_STAKE_AMOUNT"),333));//should fail, onlygovernance
//     tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, govSigner);
//     await tellor.changeUint(h.hash("_STAKE_AMOUNT"),333)
//     assert(await tellor.getUintVar(h.hash("_STAKE_AMOUNT")) == 333, "Uint should peroperly change");
//   });
//   it("migrate()", async function() {
//     let tofac = await ethers.getContractFactory("contracts/testing/TestToken.sol:TestToken");
//     let token = await tofac.deploy();
//     await token.deployed()
//     await token.mint(accounts[1].address, 500)
//     await tellor.changeAddressVar(h.hash("_OLD_TELLOR"), token.address)
//     tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
//     await tellor.migrate();
//     h.expectThrow(tellor.migrate());//should fail if run twice
//     assert(await tellor.balanceOf(accounts[1].address) == 500, "migration should work correctly")
//   });
//   it("mint()", async function() {
//     let initSupply = await tellor.totalSupply();
//     h.expectThrow(tellor.mint(accounts[3].address,500));//require onlyGovernance
//     tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, govSigner);
//     await tellor.mint(accounts[3].address,h.to18(500))
//     assert(await tellor.balanceOf(accounts[3].address) - h.to18(500) == 0, "balance should change correctly");
//     let finSupply =  await tellor.totalSupply();
//     assert(finSupply - h.to18(500) == initSupply, "Total supply should change correctly")
//   });
//   it("verify()", async function() {
//     assert(await tellor.verify() > 9000, "Contract should properly verify")
//   });
//   it("_isValid()", async function() {
//     let tofac = await ethers.getContractFactory("contracts/testing/TestToken.sol:TestToken");
//     let token = await tofac.deploy();
//     await token.deployed()
//     newController = await cfac.deploy();
//     await newController.deployed();
//     tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, govSigner);
//     h.expectThrow(tellor.changeControllerContract(token.address));//require isValid
//     await tellor.changeControllerContract(newController.address)
//   });
// });
