const { AbiCoder } = require("@ethersproject/abi");
const { expect } = require("chai");
const h = require("./helpers/helpers");
var assert = require('assert');
const web3 = require('web3');

describe("TellorX Function Tests - Treasury", function() {

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
  it("buyTreasury()", async function() {
    tellorUser = await ethers.getContractAt("contracts/Treasury.sol:Treasury",treasury.address, accounts[1]);
    await tellor.transfer(accounts[1].address,web3.utils.toWei("200"));
    await h.expectThrow(tellorUser.buyTreasury(1, web3.utils.toWei("200")));//no treasury issued
    admin = await ethers.getContractAt("contracts/Treasury.sol:Treasury",treasury.address, govSigner);
    assert(await treasury.getTreasuryFundsByUser(accounts[1].address) == web3.utils.toWei("0"), "User treasury funds should equal zero");
    await admin.issueTreasury(web3.utils.toWei("400"), 200, 100);
    await tellorUser.buyTreasury(1, web3.utils.toWei("200"));
    assert(await treasury.getTreasuryFundsByUser(accounts[1].address) == web3.utils.toWei("200"), "User treasury funds should be correct");
    let details = await treasury.getTreasuryDetails(1);
    assert(details[3] == web3.utils.toWei("200"), "Treasury details purchased should be correct");
    let acc = await treasury.getTreasuryAccount(1, accounts[1].address);
    assert(acc[0] == web3.utils.toWei("200"), "Treasury account should be correct");
    assert(await treasury.getTreasuryOwners(1) == accounts[1].address, "Get treasury owners should be correct");
    assert(await treasury.totalLocked() == web3.utils.toWei("200"), "Total locked should be correct");
  });
  it("delegateVotingPower()", async function() {
    tellorUser = await ethers.getContractAt("contracts/Treasury.sol:Treasury",treasury.address, accounts[1]);
    admin = await ethers.getContractAt("contracts/Treasury.sol:Treasury",treasury.address, govSigner);
    await admin.delegateVotingPower(accounts[1].address);
    assert(await governance.delegateOfAt(treasury.address, await ethers.provider.getBlockNumber()) == accounts[1].address, "Delegate should be correct");
  });
  it("issueTreasury()", async function() {
    tellorUser = await ethers.getContractAt("contracts/Treasury.sol:Treasury",treasury.address, accounts[1]);
    await h.expectThrow(tellorUser.issueTreasury(web3.utils.toWei("400"), 200, 100));//only governance can issue
    admin = await ethers.getContractAt("contracts/Treasury.sol:Treasury",treasury.address, govSigner);
    await admin.issueTreasury(web3.utils.toWei("400"), 200, 100);
    let details = await treasury.treasury(1);
    assert(details[0] > 0, "Treasury dateStarted should be set");
    assert(details[1] == web3.utils.toWei("400"), "Treasury amount should be correct");
    assert(details[2] == 200, "Treasury rate should be correct");
    assert(details[4] == 100, "Treasury duration should be correct");
  });
  it("payTreasury()", async function() {
    tellorUser = await ethers.getContractAt("contracts/Treasury.sol:Treasury",treasury.address, accounts[1]);
    admin = await ethers.getContractAt("contracts/Treasury.sol:Treasury",treasury.address, govSigner);
    await h.expectThrow(tellorUser.payTreasury(accounts[1].address, 1));//no treasury issued
    await admin.issueTreasury(web3.utils.toWei("400"), 200, 100);
    await h.expectThrow(tellorUser.payTreasury(accounts[1].address, 1));//not an investor and duration not passed
    await tellor.transfer(accounts[1].address,web3.utils.toWei("200"));
    await tellorUser.buyTreasury(1, web3.utils.toWei("200"));
    await h.expectThrow(tellorUser.payTreasury(accounts[1].address, 1));//treasury locked
    await h.advanceTime(100);
    await tellorUser.payTreasury(accounts[1].address, 1);
    assert(await treasury.getTreasuryFundsByUser(accounts[1].address) == 0, "User treasury funds should be zero");
    await h.expectThrow(tellorUser.payTreasury(accounts[1].address, 1));//treasury already paid to user
    assert(await tellor.balanceOf(accounts[1].address)*1 == 1*web3.utils.toWei("200")*1.02, "User balance should be correct");
  });
  it("getTreasuryAccount()", async function() {
    tellorUser = await ethers.getContractAt("contracts/Treasury.sol:Treasury",treasury.address, accounts[1]);
    await tellor.transfer(accounts[1].address,web3.utils.toWei("200"));
    admin = await ethers.getContractAt("contracts/Treasury.sol:Treasury",treasury.address, govSigner);
    await admin.issueTreasury(web3.utils.toWei("400"), 200, 100);
    let acc = await treasury.getTreasuryAccount(1, accounts[1].address) 
    assert(acc[0] *1 == 0, "Treasury account balance should be correct");
    await tellorUser.buyTreasury(1, web3.utils.toWei("200"));
    acc = await treasury.getTreasuryAccount(1, accounts[1].address) 
    assert( acc[0] == web3.utils.toWei("200"), "Treasury account balance should be correct");
  });
  it("getTreasuryDetails()", async function() {
    tellorUser = await ethers.getContractAt("contracts/Treasury.sol:Treasury",treasury.address, accounts[1]);
    await tellor.transfer(accounts[1].address,web3.utils.toWei("200"));
    admin = await ethers.getContractAt("contracts/Treasury.sol:Treasury",treasury.address, govSigner);
    await admin.issueTreasury(web3.utils.toWei("400"), 200, 100);
    await tellorUser.buyTreasury(1, web3.utils.toWei("200"));
    let details = await treasury.getTreasuryDetails(1);
    assert(details[0] > 0, "Date started should be set");
    assert(details[1] == web3.utils.toWei("400"), "Amount should be correct");
    assert(details[2] == 200, "Rate should be correct");
    assert(details[3] == web3.utils.toWei("200"), "Purchased should be correct");
  });
  it("getTreasuryFundsByUser()", async function() {
    tellorUser = await ethers.getContractAt("contracts/Treasury.sol:Treasury",treasury.address, accounts[1]);
    await tellor.transfer(accounts[1].address,web3.utils.toWei("400"));
    admin = await ethers.getContractAt("contracts/Treasury.sol:Treasury",treasury.address, govSigner);
    await admin.issueTreasury(web3.utils.toWei("400"), 200, 100);
    await tellorUser.buyTreasury(1, web3.utils.toWei("200"));
    assert(await treasury.getTreasuryFundsByUser(accounts[1].address) == web3.utils.toWei("200"), "Treasury funds should be correct");
    await tellorUser.buyTreasury(1, web3.utils.toWei("200"));
    assert(await treasury.getTreasuryFundsByUser(accounts[1].address) == web3.utils.toWei("400"), "Treasury funds should be correct");
  });
  it("getTreasuryOwners()", async function() {
    tellorUser = await ethers.getContractAt("contracts/Treasury.sol:Treasury",treasury.address, accounts[1]);
    await tellor.transfer(accounts[1].address,web3.utils.toWei("400"));
    admin = await ethers.getContractAt("contracts/Treasury.sol:Treasury",treasury.address, govSigner);
    await admin.issueTreasury(web3.utils.toWei("400"), 200, 100);
    await tellorUser.buyTreasury(1, web3.utils.toWei("200"));
    assert(await treasury.getTreasuryOwners(1) == accounts[1].address, "Treasury owners should be correct");
  });
  it("verify()", async function() {
    assert(await treasury.verify() == 9999, "Should verify");
  });
  it("wasPaid()", async function() {
    tellorUser = await ethers.getContractAt("contracts/Treasury.sol:Treasury",treasury.address, accounts[1]);
    admin = await ethers.getContractAt("contracts/Treasury.sol:Treasury",treasury.address, govSigner);
    await admin.issueTreasury(web3.utils.toWei("400"), 200, 100);
    await tellor.transfer(accounts[1].address,web3.utils.toWei("200"));
    await tellorUser.buyTreasury(1, web3.utils.toWei("200"));
    assert(await treasury.wasPaid(1, accounts[1].address) == false, "Was paid should be correct");
    await h.advanceTime(100);
    await tellorUser.payTreasury(accounts[1].address, 1);
    assert(await treasury.wasPaid(1, accounts[1].address) == true, "Was paid should be correct");
  });

});
