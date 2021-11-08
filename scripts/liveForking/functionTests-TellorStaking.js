const { AbiCoder } = require("@ethersproject/abi");
const { expect } = require("chai");
const h = require("../../test/helpers/helpers");
var assert = require('assert');
const web3 = require('web3');
const fetch = require('node-fetch')

// Hardhat forking tests for after TellorX is deployed, before init called

describe("TellorX Function Tests - TellorStaking", function() {

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
  it("depositStake()", async function() {
    this.timeout(20000000)
    let iStakeCount = await tellor.getUintVar(h.hash("_STAKE_COUNT"));
    let iDispFee = await governance.disputeFee();
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
    await h.expectThrow(tellorUser.depositStake());//doesn't have a balance
    await tellor.transfer(accounts[1].address,web3.utils.toWei("200"));
    await tellorUser.depositStake();
    let blocky = await ethers.provider.getBlock();
    await h.expectThrow(tellorUser.depositStake());//already staked
    let vars = await tellor.getStakerInfo(accounts[1].address)
    assert(vars[1] - blocky.timestamp == 0, "timestamp should be correct")
    assert(vars[0] - 1 == 0, "status should be correct")
    assert(await tellor.getUintVar(h.hash("_STAKE_COUNT")) - 1 == iStakeCount, "stake count should peroperly change");
    assert(iDispFee - await governance.disputeFee() > 0, "dispute Fee should drop")
  });
  it("requestStaking Withdraw", async function() {
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
    await h.expectThrow(tellorUser.requestStakingWithdraw());//not staked
    await tellor.transfer(accounts[1].address,web3.utils.toWei("200"));
    await tellorUser.depositStake();
    let iStakeCount = await tellor.getUintVar(h.hash("_STAKE_COUNT"));
    let iDispFee = await governance.disputeFee();
    await tellorUser.requestStakingWithdraw()
    let blocky = await ethers.provider.getBlock();
    let vars = await tellor.getStakerInfo(accounts[1].address)
    assert(vars[1] -blocky.timestamp == 0, "timestamp should be correct")
    assert(vars[0] - 2 == 0, "status should be correct")
    assert(await tellor.getUintVar(h.hash("_STAKE_COUNT"))*1 + 1 - iStakeCount * 1 == 0, "stake count should peroperly change");
    assert(await governance.disputeFee()*1 - 1*iDispFee > 0, "dispute Fee should go back to the same")
  });
  it("withdrawStake", async function() {
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
    await h.expectThrow(tellorUser.withdrawStake());//not staked
    await tellor.transfer(accounts[1].address,web3.utils.toWei("200"));
    await tellorUser.depositStake();
    await h.expectThrow(tellorUser.withdrawStake());//has not requestedWithdraw
    await tellorUser.requestStakingWithdraw()
    await h.expectThrow(tellorUser.withdrawStake());//7 days hasn't passed
    await h.advanceTime(86400*7)
    await tellorUser.withdrawStake();
    let blocky = await ethers.provider.getBlock();
    let vars = await tellor.getStakerInfo(accounts[1].address)
    assert(vars[0]* 1 == 0, "status should be correct")
  });
  it("changeStakingStatus", async function() {
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
    await tellor.transfer(accounts[1].address,web3.utils.toWei("200"));
    let initBal = await tellor.balanceOf(accounts[1].address)
    await tellorUser.depositStake();
    admin = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, govSigner);
    await admin.changeStakingStatus(accounts[1].address,2);
    let vars = await tellor.getStakerInfo(accounts[1].address)
    assert(vars[0] - 2 == 0, "status should be correct")
    await admin.changeStakingStatus(accounts[1].address,5);
    vars = await tellor.getStakerInfo(accounts[1].address)
    assert(vars[0] - 5 == 0, "status should be correct")
  });
  it("slashReporter", async function() {
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
    await tellor.transfer(accounts[1].address,web3.utils.toWei("200"));
    let initBal = await tellor.balanceOf(accounts[1].address)
    await tellorUser.depositStake();
    admin = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, govSigner);
    await admin.slashReporter(accounts[1].address, accounts[3].address)
    let blocky = await ethers.provider.getBlock();
    let vars = await tellor.getStakerInfo(accounts[1].address)
    assert(vars[0] - 5 == 0, "status should be correct")
    assert(initBal - await tellor.balanceOf(accounts[1].address) - web3.utils.toWei("100") == 0, "miner should lose stake")
    assert(await tellor.balanceOf(accounts[3].address) - web3.utils.toWei("100") == 0, "disputer should gain stake")
  });
  it("getStakerInfo", async function() {
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
    await tellor.transfer(accounts[1].address,web3.utils.toWei("200"));
    await tellorUser.depositStake();
    await tellorUser.requestStakingWithdraw()
    let blocky = await ethers.provider.getBlock();
    let vars = await tellor.getStakerInfo(accounts[1].address)
    assert(vars[1] -blocky.timestamp == 0, "timestamp should be correct")
    assert(vars[0] - 2 == 0, "status should be correct")
  });
});
