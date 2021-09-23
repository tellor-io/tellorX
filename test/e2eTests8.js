const { AbiCoder } = require("@ethersproject/abi");
const { expect } = require("chai");
const h = require("./helpers/helpers");
var assert = require('assert');
const web3 = require('web3');
const { ethers } = require("hardhat");
const { stakeAmount } = require("./helpers/helpers");
const { keccak256 } = require("ethers/lib/utils");

describe("End-to-End Tests - Eight", function() {

  const tellorMaster = "0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0"
  const DEV_WALLET = "0x39E419bA25196794B595B2a595Ea8E527ddC9856"
  const PARACHUTE = "0x83eB2094072f6eD9F57d3F19f54820ee0BaE6084"
  const BIGWALLET = "0xf977814e90da44bfa03b6295a0616a897441acec";
  const LIQUITY_PRICE_FEED = "0x4c517D4e2C851CA76d7eC94B805269Df0f2201De"
  let accounts = null
  let tellor = null
  let cfac,ofac,tfac,gfac,parachute,govBig,govTeam
  let govSigner = null

  beforeEach("deploy and setup TellorX", async function() {
    this.timeout(1000000)
    accounts = await ethers.getSigners();
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [{forking: {
            jsonRpcUrl: hre.config.networks.hardhat.forking.url,
            blockNumber:13186300

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

    /**
     *
     *
     * BEGIN SETUP MODIFICATION
     */

    master.addTip(1,web3.utils.toWei("200"))

    //create 6 miners
    let miners, m1, m2, m3, m4, m5, m6
    [m1, m2, m3, m4, m5, m6] = await ethers.getSigners()
    miners = [m1, m2, m3, m4, m5, m6]
    for (i = 0; i < miners.length; i++) {
        miner = miners[i]
        //transfer dev tokens to miners
        await oldTellorInstance.connect(devWallet).transfer(miner.address, BigInt(500E18))
        //stake 5 miners
        await oldTellorInstance.connect(miner).depositStake()
    }

    //submit values
    count = 0
    for (i = 0; i < miners.length; i++) {
        count++
        miner = miners[i]
        // console.log(4);
        let currVars = await oldTellorInstance.getNewCurrentVariables()
        await oldTellorInstance.connect(miner).submitMiningSolution(
            "nonce",
            currVars[1],
            [1, 1, 3395140000, 1, 1]
        )
        await h.advanceTime(15*60)
    }

    /**
     *
     * END SETUP MODIFICATION
     */

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

    it("Manually verify that Liquity still work (mainnet fork their state after oracle updates)", async function() {
      let liquityPriceFeed = await ethers.getContractAt("contracts/testing/IPriceFeed.sol:IPriceFeed", LIQUITY_PRICE_FEED)
      await liquityPriceFeed.fetchPrice()
      lastGoodPrice = await liquityPriceFeed.lastGoodPrice()
      assert(lastGoodPrice == "3395140000000000000000", "Liquity ether price should be correct")
      await tellor.connect(bigWallet).transfer(accounts[10].address, web3.utils.toWei("100"))
      await tellor.connect(accounts[10]).depositStake()
      await oracle.connect(accounts[10]).submitValue(h.uintTob32("1"),h.uintTob32("3395150000"),0)
      await liquityPriceFeed.fetchPrice()
      lastGoodPrice = await liquityPriceFeed.lastGoodPrice()
      assert(lastGoodPrice == "3395150000000000000000", "Liquity ether price should be correct")
      await h.advanceTime(60*60*12)
      await oracle.connect(accounts[10]).submitValue(h.uintTob32("1"),h.uintTob32("3395160000"),1)
      await liquityPriceFeed.fetchPrice()
      lastGoodPrice = await liquityPriceFeed.lastGoodPrice()
      assert(lastGoodPrice == "3395160000000000000000", "Liquity ether price should be correct")
      await h.advanceTime(60*60*12)
      await oracle.connect(accounts[10]).submitValue(h.uintTob32("1"),h.uintTob32("3395170000"),2)
      await liquityPriceFeed.fetchPrice()
      lastGoodPrice = await liquityPriceFeed.lastGoodPrice()
      assert(lastGoodPrice == "3395170000000000000000", "Liquity ether price should be correct")
    });
})
