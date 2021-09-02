const { AbiCoder } = require("@ethersproject/abi");
const { expect } = require("chai");
const h = require("./helpers/helpers");
var assert = require('assert');
const web3 = require('web3');
const { ethers } = require("hardhat");
const { stakeAmount } = require("./helpers/helpers");
const { keccak256 } = require("ethers/lib/utils");

describe("End-to-End Tests - Seven", function() {

  const tellorMaster = "0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0"
  const DEV_WALLET = "0x39E419bA25196794B595B2a595Ea8E527ddC9856"
  const PARACHUTE = "0x83eB2094072f6eD9F57d3F19f54820ee0BaE6084"
  const BIGWALLET = "0xf977814e90da44bfa03b6295a0616a897441acec";
  let accounts = null
  let tellor = null
  let cfac,ofac,tfac,gfac,parachute,govBig,govTeam
  let govSigner = null

  beforeEach("deploy and setup TellorX", async function() {
    accounts = await ethers.getSigners();
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [{forking: {
            jsonRpcUrl: hre.config.networks.hardhat.forking.url,
            blockNumber:13037866

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
    devWallet = await ethers.provider.getSigner(DEV_WALLET);
    bigWallet = await ethers.provider.getSigner(BIGWALLET);
    master = await oldTellorInstance.connect(devWallet)
    await master.proposeFork(controller.address);
    let _id = await master.getUintVar(h.hash("_DISPUTE_COUNT"))
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
    await tellor.init(governance.address,oracle.address,treasury.address)
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [governance.address]}
    )
    await accounts[1].sendTransaction({to:governance.address,value:ethers.utils.parseEther("1.0")});
    govSigner = await ethers.provider.getSigner(governance.address);
    });
  it("Make sure correct value is removed after multiple disputes on an id", async function() {
    await tellor.transfer(accounts[1].address,web3.utils.toWei("100"));
    await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
    await tellorUser.depositStake();
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[2]);
    await tellorUser.depositStake();
    oracle2 = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[2]);
    await oracle2.submitValue( ethers.utils.formatBytes32String("2"),150,0);//clear inflationary rewards
    await h.advanceTime(86400)
    oracle = await ethers.getContractAt("contracts/Oracle.sol:Oracle",oracle.address, accounts[1]);
    await oracle.submitValue( ethers.utils.formatBytes32String("1"),50,0);
    await oracle2.submitValue( ethers.utils.formatBytes32String("1"),100,1);
    let blocky1 = await ethers.provider.getBlock();
    await h.advanceTime(86400)
    assert(await oracle.getTimestampIndexByTimestamp(ethers.utils.formatBytes32String("1"),blocky1.timestamp) == 1, "index should be correct")
    await oracle.submitValue( ethers.utils.formatBytes32String("1"),200,2);
    let blocky2 = await ethers.provider.getBlock();
    await oracle2.submitValue( ethers.utils.formatBytes32String("1"),300,3);
    let blocky3 = await ethers.provider.getBlock();
    await h.advanceTime(86400)
    await oracle.submitValue( ethers.utils.formatBytes32String("1"),400,4);
    await oracle2.submitValue( ethers.utils.formatBytes32String("1"),500,5);
    let blocky4 = await ethers.provider.getBlock();
    assert(await oracle.getTimestampIndexByTimestamp(ethers.utils.formatBytes32String("1"),blocky3.timestamp) == 3, "index should be correct");
    admin = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, govSigner);
    await admin.removeValue( ethers.utils.formatBytes32String("1"),blocky1.timestamp);
    assert(await oracle.getTimestampIndexByTimestamp(ethers.utils.formatBytes32String("1"),blocky3.timestamp) == 2, "index should be correct");
    assert(await oracle.getTimestampIndexByTimestamp(ethers.utils.formatBytes32String("1"),blocky4.timestamp) == 4, "index should be correct");
    await admin.removeValue( ethers.utils.formatBytes32String("1"),blocky2.timestamp);
    assert(await oracle.getTimestampIndexByTimestamp(ethers.utils.formatBytes32String("1"),blocky2.timestamp) == 0, "index should be correct");
    assert(await oracle.getTimestampIndexByTimestamp(ethers.utils.formatBytes32String("1"),blocky3.timestamp) == 1, "index should be correct");
    console.log("v1: " + await oracle.getValueByTimestamp(ethers.utils.formatBytes32String("1"),blocky1.timestamp));
    console.log("v2: " + await oracle.getValueByTimestamp(ethers.utils.formatBytes32String("1"),blocky2.timestamp));
    console.log("v3: " + await oracle.getValueByTimestamp(ethers.utils.formatBytes32String("1"),blocky3.timestamp));
    console.log("v4: " + await oracle.getValueByTimestamp(ethers.utils.formatBytes32String("1"),blocky4.timestamp));
    assert(await oracle.getValueByTimestamp(ethers.utils.formatBytes32String("1"),blocky1.timestamp) == "0x", "value should be correct");
    assert(await oracle.getValueByTimestamp(ethers.utils.formatBytes32String("1"),blocky2.timestamp) == "0x", "value should be correct");
    assert(await oracle.getValueByTimestamp(ethers.utils.formatBytes32String("1"),blocky3.timestamp) - 300 == 0, "value should be correct");
    assert(await oracle.getValueByTimestamp(ethers.utils.formatBytes32String("1"),blocky4.timestamp) - 500 == 0, "value should be correct");
  })
});
