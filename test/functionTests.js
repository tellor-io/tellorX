const { AbiCoder } = require("@ethersproject/abi");
const { expect } = require("chai");
const h = require("./helpers/helpers");

describe("TellorX Function Tests", function() {

    const tellorMaster = "0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0"
    const DEV_WALLET = "0x39E419bA25196794B595B2a595Ea8E527ddC9856"
    let accounts = null
    let tellor = null
    let cfac = null
  
  beforeEach("deploy and setup TellorX", async function() {
    accounts = await ethers.getSigners();
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [DEV_WALLET]}
    )
        //Steps to Deploy:
        //Deploy Governance, Oracle, Treasury, and Controller. 
        //Fork mainnet Ethereum, changeTellorContract to Controller
        //run init in Controller

    oldTellorInstance = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor", tellorMaster)
    let gfac = await ethers.getContractFactory("contracts/Governance.sol:Governance");
    let ofac = await ethers.getContractFactory("contracts/Oracle.sol:Oracle");
    let tfac = await ethers.getContractFactory("contracts/Treasury.sol:Treasury");
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
    const devWallet = await ethers.provider.getSigner(DEV_WALLET);
    master = await oldTellorInstance.connect(devWallet)
    await master.changeTellorContract(controller.address);
    tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, devWallet);
    await tellor.deployed();
    await tellor.init(governance.address,oracle.address,treasury.address)
  });
  it("Transition.sol - init()", async function() {
    expect(await tellor.getAddressVars(h.hash("_GOVERNANCE_CONTRACT")) == governance.address, "Governance Address should be correct");
    expect(await tellor.getAddressVars(h.hash("_TREASURY_CONTRACT")) == treasury.address, "Governance Address should be correct");
    expect(await tellor.getAddressVars(h.hash("_ORACLE_CONTRACT")) == oracle.address, "Governance Address should be correct");
    h.expectThrow(tellor.init(oracle.address,oracle.address,oracle.address))
    newController = await cfac.deploy();
    await master.changeTellorContract(newController.address);
    tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[0]);
    h.expectThrow(tellor.init(oracle.address,oracle.address,oracle.address));
  });
});