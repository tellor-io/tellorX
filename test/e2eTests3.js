const { AbiCoder } = require("@ethersproject/abi");
const { expect } = require("chai");
const h = require("./helpers/helpers");
var assert = require('assert');
const web3 = require('web3');

describe("End-to-End Tests - Three", function() {

    const tellorMaster = "0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0"
    const DEV_WALLET = "0x39E419bA25196794B595B2a595Ea8E527ddC9856"
    let accounts = null
    let tellor = null
    let cfac,ofac,tfac,gfac
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
    await accounts[1].sendTransaction({to:governance.address,value:ethers.utils.parseEther("1.0")});
    govSigner = await ethers.provider.getSigner(governance.address);
  });
  it("Test a valid vote on every approved function", async function() {
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[1]);
    admin = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, govSigner);
    // Reference: function proposeVote(address _contract, bytes4 _function, bytes calldata _data, uint256 _timestamp)

    //changeControllerContract(address)
    let newController = await cfac.deploy();
    await newController.deployed();

    await h.expectThrow(governance.proposeVote(tellor.address, 0x3c46a185, accounts[2].address, web3.utils.toWei('0'))); // no money
    await admin.mint(accounts[1].address, web3.utils.toWei("200000"));
    // await governance.proposeVote(tellorMaster, 0x3c46a185, ethers.utils.hexZeroPad(newController.address,32), 0);
    await governance.proposeVote(tellorMaster, 0x3c46a185, "0x000000000000000000000000d9Ad0E4E18F2430719E73b2f824C54CFA5D703b6", 0);
    await governance.vote(1, true, false);
    await h.advanceTime(604800);
    await governance.tallyVotes(1);
    await h.advanceTime(86400);
    console.log("oCon: " + await tellor.getAddressVars(h.hash("_TELLOR_CONTRACT")));
    await governance.executeVote(1);
    console.log("nCon: " + await tellor.getAddressVars(h.hash("_TELLOR_CONTRACT")));
    console.log("Info: " + await governance.getVoteInfo(1));
    tellorUser = await ethers.getContractAt("contracts/Controller.sol:Controller", controller.address, accounts[1]);
    console.log("Verify: " + await tellorUser.verify());
    isValid = await tellorUser._isValid(controller.address);
    console.log("Verify2: " + isValid[0] + " " + isValid[1]);
    await admin.changeControllerContract(newController.address);
    assert(await tellor.getAddressVars(h.hash("_TELLOR_CONTRACT")) == newController.address);

    //changeGovernanceContract(address)
    let newGovernance = await gfac.deploy();
    await newGovernance.deployed();
    await governance.proposeVote(tellorMaster, 0xe8ce51d7, "0x0000000000000000000000002B63d6e98E66C7e9fe11225Ba349B0B33234D9A2", 0);
    await governance.vote(2, true, false);
    await h.advanceTime(604800);
    await governance.tallyVotes(2);
    await h.advanceTime(86400);
    await governance.executeVote(2);
    assert(await tellor.getAddressVars(h.hash("_GOVERNANCE_CONTRACT")) == newGovernance.address);

    //changeOracleContract(address)
    let newOracle = await ofac.deploy();
    await newOracle.deployed();
    console.log("oracle: " + newOracle.address);
    await governance.proposeVote(tellorMaster, 0x1cbd3151, "0x000000000000000000000000729b7E8D2021F888015416d53b9d82666ec94469", 0);
    // await governance.vote(3, true, false);
    // await h.advanceTime(604800);
    // await governance.tallyVotes(3);
    // await h.advanceTime(86400);
    // await governance.executeVote(3);
    // assert(await tellor.getAddressVars(h.hash("_ORACLE_CONTRACT")) == newOracle.address);

  });
});
