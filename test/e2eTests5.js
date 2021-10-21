const { AbiCoder } = require("@ethersproject/abi");
const { expect } = require("chai");
const h = require("./helpers/helpers");
var assert = require('assert');
const web3 = require('web3');
const BN= require('bignumber.js');
const { stakeAmount } = require("./helpers/helpers");
const fetch = require('node-fetch')

describe("End-to-End Tests - Five", function() {

    const tellorMaster = "0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0"
    const DEV_WALLET = "0x39E419bA25196794B595B2a595Ea8E527ddC9856"
    const BIGWALLET = "0xf977814e90da44bfa03b6295a0616a897441acec";
    let accounts = null
    let tellor = null
    let cfac,ofac,tfac,gfac
    let govSigner = null
    let run = 0;
    let mainnetBlock = 0;

  beforeEach("deploy and setup TellorX", async function() {
    this.timeout(20000000)
    if(run == 0){
      const directors = await fetch('https://api.blockcypher.com/v1/eth/main').then(response => response.json());
      mainnetBlock = directors.height - 15;
      console.log("     Forking from block: ",mainnetBlock)
      run = 1;
    }
    accounts = await ethers.getSigners();
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [{forking: {
            jsonRpcUrl: hre.config.networks.hardhat.forking.url,
            blockNumber: mainnetBlock
          },},],
      });
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [DEV_WALLET]}
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
    controller = await cfac.deploy(governance.address, oracle.address, treasury.address);
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
    govTeam = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",governance.address, devWallet);
    govBig = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",governance.address, bigWallet);
    await tellor.deployed();
    await tellor.init()
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [governance.address]}
    )
    await accounts[1].sendTransaction({to:governance.address,value:ethers.utils.parseEther("1.0")});
    govSigner = await ethers.provider.getSigner(governance.address);
  });
  it("Test dispute and settling on old contract (transition)", async function() {
    this.timeout(20000000)
        const directors = await fetch('https://api.blockcypher.com/v1/eth/main').then(response => response.json());
        mainnetBlock = directors.height - 15;
        console.log("     Forking from block: ",mainnetBlock)
      accounts = await ethers.getSigners();
      await hre.network.provider.request({
        method: "hardhat_reset",
        params: [{forking: {
              jsonRpcUrl: hre.config.networks.hardhat.forking.url,
              blockNumber: mainnetBlock
            },},],
        });
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [DEV_WALLET]}
          )
          await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [BIGWALLET]}
          )
      oldTellorInstance = await ethers.getContractAt("contracts/tellor3/ITellor.sol:ITellor", tellorMaster)
      gfac = await ethers.getContractFactory("contracts/testing/TestGovernance.sol:TestGovernance");
      ofac = await ethers.getContractFactory("contracts/Oracle.sol:Oracle");
      tfac = await ethers.getContractFactory("contracts/Treasury.sol:Treasury");
      cfac = await ethers.getContractFactory("contracts/testing/TestController.sol:TestController");
      governance = await gfac.deploy();
      oracle = await ofac.deploy();
      treasury = await tfac.deploy();
      controller = await cfac.deploy(governance.address, oracle.address, treasury.address);
      await governance.deployed();
      await oracle.deployed();
      await treasury.deployed();
      await controller.deployed();
      await accounts[0].sendTransaction({to:DEV_WALLET,value:ethers.utils.parseEther("1.0")});
      const devWallet = await ethers.provider.getSigner(DEV_WALLET);
      const bigWallet = await ethers.provider.getSigner(BIGWALLET);
      master = await oldTellorInstance.connect(devWallet)
      await master.transfer(accounts[2].address,web3.utils.toWei("500"));
      let count = await master.getNewValueCountbyRequestId(1);
      let timestamp = await master.getTimestampbyRequestIDandIndex(1,count.toNumber() - 1);
      tellorUser = await ethers.getContractAt("contracts/interfaces/IController.sol:IController",tellorMaster, accounts[2]);
      let dispBal1 = await master.balanceOf(accounts[2].address)
      await tellorUser.beginDispute(1,timestamp,4);
      let newId = await master.getUintVar(web3.utils.keccak256("_DISPUTE_COUNT"));
      await master.proposeFork(controller.address);
      let _id = await master.getUintVar(h.hash("_DISPUTE_COUNT"))
      await master.vote(_id,true)
      master = await oldTellorInstance.connect(bigWallet)
      await master.vote(_id,true);
      await h.advanceTime(86400 * 8)
      await master.tallyVotes(_id)
      await h.advanceTime(86400 * 2.5)
      await master.updateTellor(_id)
      tellor = await ethers.getContractAt("contracts/testing/TestController.sol:TestController",tellorMaster, devWallet);
      await tellor.deployed();
      await tellor.init()
      let dispVars = await tellor.getAllDisputeVars(newId)
      let minerBal1 = await tellor.balanceOf(dispVars[4])
      assert(dispVars[1] == false, "dispute should not be executed")
      assert(dispVars[7][0] == 1, "requestID should be correct")
      await tellorUser.vote(newId,true);
      dispVars = await tellor.getAllDisputeVars(newId)
      assert(dispVars[8] - await tellor.balanceOf(accounts[2].address) == 0, "tally should be correct")
      await h.advanceTime(86400 * 2.5)
      await tellorUser.tallyVotes(newId);
      dispVars = await tellor.getAllDisputeVars(newId)
      assert(dispVars[2], "vote should have passed")
      await h.advanceTime(86400 * 2.5)
      await tellorUser.unlockDisputeFee(newId);
      let minerBal2 = await tellor.balanceOf(dispVars[4])
      let dispBal2 = await master.balanceOf(accounts[2].address)
      assert(dispVars[1], "vote should be executed")
      assert(dispBal2 - dispBal1 == web3.utils.toWei("100"), "disputer should win the stake")
      minerBalDiff = minerBal1-minerBal2
      assert(minerBalDiff == web3.utils.toWei("100"), "miner should lose the stake")
  })
  })
