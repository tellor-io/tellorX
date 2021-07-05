const { AbiCoder } = require("@ethersproject/abi");
const { expect } = require("chai");
const h = require("./helpers/helpers");

describe("TellorX Function Tests", function() {

    const tellorMaster = "0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0"
    const DEV_WALLET = "0x39E419bA25196794B595B2a595Ea8E527ddC9856"
    let accounts = null
    let tellor = null
    let cfac = null
    let govSigner = null
  
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
    let gfac = await ethers.getContractFactory("contracts/testing/TestGovernance.sol:TestGovernance");
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
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [governance.address]}
    )
    accounts[1].sendTransaction({to:governance.address,value:ethers.utils.parseEther("1.0")});
    govSigner = await ethers.provider.getSigner(governance.address);
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
  it("Governance.sol - constructor()", async function() {
    let vars = await governance.getTypeDetails(1);
    expect(vars[0] == 0 , "quorum on type 1 should be correct")
    expect(vars[1] == 86400 * 2 , "vote Duration on type 1 should be correct")
    vars = await governance.getTypeDetails(2);
    expect(vars[0] == 5 , "quorum on type 2 should be correct")
    expect(vars[1] == 86400 * 7 , "vote Duration on type 2 should be correct")
    vars = await governance.getTypeDetails(3);
    expect(vars[0] == 2, "quorum on type 3 should be correct")
    expect(vars[1] == 86400 * 7 , "vote Duration on type 3 should be correct")
    let initFuncs = [0x3c46a185,0xe8ce51d7,0x1cbd3151,0xbd87e0c9, 0x740358e6,
      0x40c10f19,0xe8a230db,0xfad40294,0xe280e8e8,0x6274885f,0xf3ff955a];
    for(let _i =0;_i< initFuncs.length;_i++){
      res = await governance.isFunctionApproved(initFuncs[_i])
      expect(res == true, "Function should be approved")
    }
  });
  it("Controller.sol - changeControllerContract()", async function() {
    newController = await cfac.deploy();
    await newController.deployed();
    tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[0]);
    h.expectThrow(tellor.changeControllerContract(newController.address));//should fail, onlygovernance
    tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, govSigner);
    h.expectThrow(tellor.changeControllerContract(accounts[3].address));//require isValid
    await tellor.changeControllerContract(newController.address)
    expect(await tellor.getAddressVars(h.hash("_TELLOR_CONTRACT")) == newController.address, "Controller Address should be correct");
  });
});