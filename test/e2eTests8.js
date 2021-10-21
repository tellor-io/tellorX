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
            blockNumber:13348402

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
    await tellor.init()
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
      await oracle.connect(accounts[10]).submitValue(h.uintTob32("1"),h.uintTob32("3395150000"),0,'0x')
      await liquityPriceFeed.fetchPrice()
      lastGoodPrice = await liquityPriceFeed.lastGoodPrice()
      assert(lastGoodPrice == "3395150000000000000000", "Liquity ether price should be correct")
      await h.advanceTime(60*60*12)
      await oracle.connect(accounts[10]).submitValue(h.uintTob32("1"),h.uintTob32("3395160000"),1,'0x')
      await liquityPriceFeed.fetchPrice()
      lastGoodPrice = await liquityPriceFeed.lastGoodPrice()
      assert(lastGoodPrice == "3395160000000000000000", "Liquity ether price should be correct")
      await h.advanceTime(60*60*12)
      await oracle.connect(accounts[10]).submitValue(h.uintTob32("1"),h.uintTob32("3395170000"),2,'0x')
      await liquityPriceFeed.fetchPrice()
      lastGoodPrice = await liquityPriceFeed.lastGoodPrice()
      assert(lastGoodPrice == "3395170000000000000000", "Liquity ether price should be correct")
    });

    it("Manually verify that Ampleforth still works", async function() {
      this.timeout(1000000)
      let mofac = await ethers.getContractFactory("contracts/testing/MedianOracle.sol:MedianOracle");
      let tpfac = await ethers.getContractFactory("contracts/testing/TellorProvider.sol:TellorProvider");
      medianOracle = await mofac.deploy();
      await medianOracle.deployed();
      tellorProvider = await tpfac.deploy(tellorMaster, medianOracle.address);
      await tellorProvider.pushTellor()
      currentValue = await tellor.getLastNewValueById(10)
      payload = await medianOracle.payload_();
      assert(currentValue[0] - payload == 0, "Ample price should be retrieved correctly")
      await tellor.transfer(accounts[10].address,web3.utils.toWei("100"));
      await tellor.connect(accounts[10]).depositStake();
      await oracle.connect(accounts[10]).submitValue(h.uintTob32(10),h.uintTob32(950000),0,'0x');
      await tellorProvider.pushTellor()
      payload = await medianOracle.payload_();
      assert(payload == 950000, "Ample price should be retrieved correctly")
    });

    it("Test updating all of the old ID's (mapping of bytes to uint correct and granularity preserved)", async function() {
      this.timeout(1000000)
      await tellor.transfer(accounts[10].address,web3.utils.toWei("100"));
      await tellor.connect(accounts[10]).depositStake();

      value1 = await tellor.getLastNewValueById(1)
      assert(value1[0] > 0, "Value should be set")
      await oracle.connect(accounts[10]).submitValue(h.uintTob32(1),h.uintTob32(950000),0,'0x');
      value1 = await tellor.getLastNewValueById(1)
      assert(value1[0] == 950000, "Value should be set")
      await h.advanceTime(60*60*12)

      value10 = await tellor.getLastNewValueById(10)
      assert(value10[0] > 0, "Value should be set")
      await oracle.connect(accounts[10]).submitValue(h.uintTob32(10),h.uintTob32(960000),0,'0x');
      value10 = await tellor.getLastNewValueById(10)
      assert(value10[0] == 960000, "Value should be set")
      await h.advanceTime(60*60*12)

      value22 = await tellor.getLastNewValueById(22)
      assert(value22[0] > 0, "Value should be set")
      await oracle.connect(accounts[10]).submitValue(h.uintTob32(22),h.uintTob32(970000),0,'0x');
      value22 = await tellor.getLastNewValueById(22)
      assert(value22[0] == 970000, "Value should be set")
      await h.advanceTime(60*60*12)

      value54 = await tellor.getLastNewValueById(54)
      assert(value54[0] > 0, "Value should be set")
      await oracle.connect(accounts[10]).submitValue(h.uintTob32(54),h.uintTob32(980000),0,'0x');
      value54 = await tellor.getLastNewValueById(54)
      assert(value54[0] == 980000, "Value should be set")
      await h.advanceTime(60*60*12)
    });

    it("Test old using Tellor still works", async function() {
      let utfac = await ethers.getContractFactory("contracts/testing/IsUsingTellor.sol:IsUsingTellor");
      usingTellor = await utfac.deploy(tellorMaster)
      await tellor.transfer(accounts[10].address,web3.utils.toWei("100"));
      await tellor.connect(accounts[10]).depositStake();

      await oracle.connect(accounts[10]).submitValue(h.uintTob32(1),h.uintTob32(940000),0,'0x');
      await h.advanceTime(60*60*12)
      await oracle.connect(accounts[10]).submitValue(h.uintTob32(1),h.uintTob32(950000),1,'0x');
      let blocky = await ethers.provider.getBlock()
      // retrieveData()
      value = await usingTellor.retrieveData(1, blocky.timestamp)
      assert(value == 950000, "Value should be retrieved correctly 1")
      // isInDispute() - not present
      // getNewValueCountbyRequestId
      let count = await usingTellor.getNewValueCountbyRequestId(1)
      assert(count == 2, "Value count should be correct")
      // getTimestampbyRequestIDandIndex()
      let retrievedTimestamp = await usingTellor.getTimestampbyRequestIDandIndex(1,1)
      assert(retrievedTimestamp == blocky.timestamp, "Timestamp should be retrieved correctly")
      // getCurrentValue()
      value = await usingTellor.getCurrentValue(1);
      assert(value[1] == 950000, "Value should be retrieved correctly 2")
      // getIndexForDataBefore()
      await h.advanceTime(60*60*12)
      await oracle.connect(accounts[10]).submitValue(h.uintTob32(1),h.uintTob32(960000),2,'0x');
      blocky = await ethers.provider.getBlock()
      index = await usingTellor.getIndexForDataBefore(1, blocky.timestamp-1)
      assert(index[1] == 1, "Index should be retrieved correctly")
      // getDataBefore()
      value = await usingTellor.getDataBefore(1, blocky.timestamp)
      assert(value[1] == 950000, "Value should be retrieved correctly 3")
    });

    it("Test submit value with bytes data argument", async function() {
      await tellor.transfer(accounts[10].address,web3.utils.toWei("100"));
      await tellor.transfer(accounts[1].address, web3.utils.toWei("200"))
      await tellor.connect(accounts[10]).depositStake();
      let n = 42
      let bytesData = "0x"+n.toString(16)
      let requestId = keccak256(bytesData)
      await h.expectThrow(oracle.connect(accounts[10]).submitValue(requestId, h.uintTob32(930000), 0, ("0x"+n.toString(15)))) // requestId should equal hash(_data)
      await oracle.connect(accounts[10]).submitValue(requestId,h.uintTob32(940000),0,bytesData);
      await h.advanceTime(60*60*12)
      await oracle.connect(accounts[10]).submitValue(requestId,h.uintTob32(950000),1,bytesData);
      let blocky = await ethers.provider.getBlock()
      value = await tellor["retrieveData(uint256,uint256)"](requestId, blocky.timestamp);
      assert(value == 950000, "Value should be retrieved correctly 1")
      await h.advanceTime(60*60*12)
      await oracle.connect(accounts[1]).tipQuery(requestId, web3.utils.toWei("200"), bytesData)
      let bal1 = await tellor.balanceOf(accounts[10].address)
      await oracle.connect(accounts[10]).submitValue(requestId,h.uintTob32(960000),2,bytesData);
      let bal2 = await tellor.balanceOf(accounts[10].address)
      diff = bal2-bal1
      assert(diff >= web3.utils.toWei("100"), "Reporter balance should update correctly")
    })
})
