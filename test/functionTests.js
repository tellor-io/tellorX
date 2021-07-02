const { AbiCoder } = require("@ethersproject/abi");
const { expect } = require("chai");
const helpers = require("./helpers/helpers");

describe("TellorX Function Tests", function() {

    const tellorMaster = "0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0"
    const DEV_WALLET = "0x39E419bA25196794B595B2a595Ea8E527ddC9856"
  
  beforeEach("deploy and setup TellorX", async function() {
    const accounts = await ethers.getSigners();
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [DEV_WALLET]}
    )
        //steps: deploy Governance, Oracle, Treasury, and Controller. 
        //changeTellorContract to Controller
        //run init in Controller

    oldTellorInstance = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor", tellorMaster)
    let gfac = await ethers.getContractFactory("contracts/Governance.sol:Governance");
    let ofac = await ethers.getContractFactory("contracts/Oracle.sol:Oracle");
    let tfac = await ethers.getContractFactory("contracts/Treasury.sol:Treasury");
    let cfac = await ethers.getContractFactory("contracts/Controller.sol:Controller");
    console.log("here")
    governance = await gfac.deploy();
    console.log("here")
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
    const tellor = await ethers.getContractAt("ITellor",tellorMaster, devWallet);
    await tellor.deployed();
    await tellor.init(governance.address,oracle.address,treasury.address)
  });
  it("Transition.sol - init()", async function() {
    assert(await tellor.getAddresses(hash(_GOVERNANCE_CONTRACT)) == governance.address, "Governance Address should be correct");
    assert(await tellor.getAddresses(hash(_TREASURY_CONTRACT)) == governance.address, "Governance Address should be correct");
    assert(await tellor.getAddresses(hash(_ORACLE_CONTRACT)) == governance.address, "Governance Address should be correct");
    helpers.expectThrow(tellor.init(oracle.address,oracle.address,oracle.address))
    newController = await cfac.deploy();
    await master.changeTellorContract(newController.address);
    const tellor = await ethers.getContractAt("ITellor",tellorMaster, accounts[0]);
    helpers.expectThrow(tellor.init(oracle.address,oracle.address,oracle.address));
  });
});