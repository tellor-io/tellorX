const { AbiCoder } = require("@ethersproject/abi");
const { expect } = require("chai");
const h = require("../../test/helpers/helpers");
var assert = require('assert');
const web3 = require('web3');
const fetch = require('node-fetch')

// Hardhat forking tests for after TellorX is deployed, before init called

describe("TellorX Function Tests - Controller", function() {

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
  it("changeControllerContract()", async function() {
    this.timeout(20000000)
    newController = await cfac.deploy(governance.address, oracle.address, treasury.address);
    await newController.deployed();
    tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[0]);
    h.expectThrow(tellor.changeControllerContract(newController.address));//should fail, onlygovernance
    tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, govSigner);
    h.expectThrow(tellor.changeControllerContract(accounts[3].address));//require isValid
    await tellor.changeControllerContract(newController.address)
    assert(await tellor.getAddressVars(h.hash("_TELLOR_CONTRACT")) == newController.address, "Controller Address should be correct");
  });
  it("changeGovernanceContract()", async function() {
    newGovernance = await gfac.deploy();
    await newGovernance.deployed();
    tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[0]);
    h.expectThrow(tellor.changeGovernanceContract(newGovernance.address));//should fail, onlygovernance
    tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, govSigner);
    h.expectThrow(tellor.changeGovernanceContract(accounts[3].address));//require isValid
    await tellor.changeGovernanceContract(newGovernance.address)
    assert(await tellor.getAddressVars(h.hash("_GOVERNANCE_CONTRACT")) == newGovernance.address, "Governance Address should be correct");
  });
  it("changeOracleContract()", async function() {
    newOracle = await ofac.deploy();
    await newOracle.deployed();
    tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[0]);
    h.expectThrow(tellor.changeOracleContract(newOracle.address));//should fail, onlygovernance
    tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, govSigner);
    h.expectThrow(tellor.changeOracleContract(accounts[3].address));//require isValid
    await tellor.changeOracleContract(newOracle.address)
    assert(await tellor.getAddressVars(h.hash("_ORACLE_CONTRACT")) == newOracle.address, "Governance Address should be correct");
  });
  it("changeTreasuryContract()", async function() {
    newTreasury = await tfac.deploy();
    await newTreasury.deployed();
    tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[0]);
    h.expectThrow(tellor.changeTreasuryContract(newTreasury.address));//should fail, onlygovernance
    tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, govSigner);
    h.expectThrow(tellor.changeTreasuryContract(accounts[3].address));//require isValid
    await tellor.changeTreasuryContract(newTreasury.address)
    assert(await tellor.getAddressVars(h.hash("_TREASURY_CONTRACT")) == newTreasury.address, "Governance Address should be correct");
  });
  it("changeUint()", async function() {
    tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[0]);
    h.expectThrow(tellor.changeUint(h.hash("_STAKE_AMOUNT"),333));//should fail, onlygovernance
    tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, govSigner);
    await tellor.changeUint(h.hash("_STAKE_AMOUNT"),333)
    assert(await tellor.getUintVar(h.hash("_STAKE_AMOUNT")) == 333, "Uint should peroperly change");
  });
  // No `changeAddressVar` function in real controller, can't change _OLD_TELLOR address
  // it("migrate()", async function() {
  //   let tofac = await ethers.getContractFactory("contracts/testing/TestToken.sol:TestToken");
  //   let token = await tofac.deploy();
  //   await token.deployed()
  //   await token.mint(accounts[1].address, 500)
  //   await tellor.changeAddressVar(h.hash("_OLD_TELLOR"), token.address)
  //   tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
  //   await tellor.migrate();
  //   h.expectThrow(tellor.migrate());//should fail if run twice
  //   assert(await tellor.balanceOf(accounts[1].address) == 500, "migration should work correctly")
  // });
  it("mint()", async function() {
    let initSupply = await tellor.totalSupply();
    h.expectThrow(tellor.mint(accounts[3].address,500));//require onlyGovernance
    tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, govSigner);
    await tellor.mint(accounts[3].address,h.to18(500))
    assert(await tellor.balanceOf(accounts[3].address) - h.to18(500) == 0, "balance should change correctly");
    let finSupply =  await tellor.totalSupply();
    assert(finSupply.sub(h.to18(500)).eq(initSupply), "Total supply should change correctly")
  });
  it("verify()", async function() {
    assert(await tellor.verify() > 9000, "Contract should properly verify")
  });
  it("_isValid()", async function() {
    let tofac = await ethers.getContractFactory("contracts/testing/TestToken.sol:TestToken");
    let token = await tofac.deploy();
    await token.deployed()
    newController = await cfac.deploy(governance.address, oracle.address, treasury.address);
    await newController.deployed();
    tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, govSigner);
    h.expectThrow(tellor.changeControllerContract(token.address));//require isValid
    await tellor.changeControllerContract(newController.address)
  });
});
