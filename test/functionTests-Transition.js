const { AbiCoder } = require("@ethersproject/abi");
const { expect } = require("chai");
const h = require("./helpers/helpers");
var assert = require('assert');
const web3 = require('web3');
const fetch = require('node-fetch')

describe("TellorX Function Tests - Transition", function() {

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
    controller = await cfac.deploy();
    await governance.deployed();
    await oracle.deployed();
    await treasury.deployed();
    await controller.deployed();
    await accounts[0].sendTransaction({to:DEV_WALLET,value:ethers.utils.parseEther("1.0")});
    const devWallet = await ethers.provider.getSigner(DEV_WALLET);
    const bigWallet = await ethers.provider.getSigner(BIGWALLET);
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
    tellor = await ethers.getContractAt("contracts/testing/TestController.sol:TestController",tellorMaster, devWallet);
    await tellor.deployed();
    await tellor.init(governance.address,oracle.address,treasury.address)
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [governance.address]}
    )
    await accounts[1].sendTransaction({to:governance.address,value:ethers.utils.parseEther("1.0")});
    govSigner = await ethers.provider.getSigner(governance.address);
  });
  it("init()", async function() {
    this.timeout(20000000)
    assert(await tellor.getAddressVars(h.hash("_GOVERNANCE_CONTRACT")) == governance.address, "Governance Address should be correct");
    assert(await tellor.getAddressVars(h.hash("_TREASURY_CONTRACT")) == treasury.address, "Governance Address should be correct");
    assert(await tellor.getAddressVars(h.hash("_ORACLE_CONTRACT")) == oracle.address, "Governance Address should be correct");
    assert(await tellor.getUintVar(h.hash("_STAKE_AMOUNT")) - h.to18(100) == 0, "stake amount should peroperly change");
    await h.expectThrow(tellor.init(oracle.address,oracle.address,oracle.address));
    assert(await tellor.getUintVar(h.hash("_SWITCH_TIME")) > 0, "switch time should be correct")
  });
  it("getTimestampbyRequestIDandIndex()", async function() {
    let _index = await tellor.getNewValueCountbyRequestId(1);
    let _t = await tellor.getTimestampbyRequestIDandIndex(1,_index -2);
    assert(_t > 0, "timestamp in old system should be correct")
    await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[2]);
    await tellorUser.depositStake();
    oracle2 = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[2]);
    await oracle2.submitValue(h.uintTob32(1),150,0);//clear inflationary rewards
    let blocky = await ethers.provider.getBlock();
    _t = await tellor.getTimestampbyRequestIDandIndex(1,0);
    assert(_t == blocky.timestamp, "timestamp should be correct")
  });
  it("retrieveData()", async function() {
    let _index = await tellor.getNewValueCountbyRequestId(1);
    let _t = await tellor.getTimestampbyRequestIDandIndex(1,_index -2);
    let rdata = await tellor.retrieveData(1,_t);
    assert(rdata > 0, "data must be present")
    await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[2]);
    await tellorUser.depositStake();
    oracle2 = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[2]);
    await oracle2.submitValue(h.uintTob32(1),150,0);//clear inflationary rewards
    _t = tellor.getTimestampbyRequestIDandIndex(1,0);
    rdata = await tellor.retrieveData(1,_t);
    assert(rdata-150 == 0 , "data must be correct")
  });
  it("getLastNewValueById()", async function() {
    let rdata = await tellor.getLastNewValueById(1);
    assert(rdata[0] > 0, "data must be present")
    assert(rdata[1], "must get data")
    await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[2]);
    await tellorUser.depositStake();
    oracle2 = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[2]);
    await oracle2.submitValue(h.uintTob32(1),150,0);//clear inflationary rewards
    rdata = await tellor.getLastNewValueById(1);
    assert(rdata[0] -150 == 0 , "data must be correct")
    assert(rdata[1], "must get data")
  });
  it("sliceUint()", async function() {
    await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[2]);
    await tellorUser.depositStake();
    oracle2 = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[2]);
    await oracle2.submitValue( ethers.utils.formatBytes32String("1"),150,0);//clear inflationary rewards
    let val = oracle.getCurrentValue(ethers.utils.formatBytes32String("1"))
    assert(await tellor.sliceUintTest(val) - 150 == 0, "sliceUint shoudl work properly")
  });
  it("fallback()", async function() {
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [{forking: {
            jsonRpcUrl: hre.config.networks.hardhat.forking.url,
            blockNumber: 12762660 //fork old one (non-parachute), so we don't need upgrade process
          },},],
      });
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [DEV_WALLET]}
    )
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
    const devWallet = await ethers.provider.getSigner(DEV_WALLET);
    const bigWallet = await ethers.provider.getSigner(BIGWALLET);
    master = await oldTellorInstance.connect(devWallet)
    await master.changeTellorContract(controller.address)
    tellor = await ethers.getContractAt("contracts/testing/TestController.sol:TestController",tellorMaster, devWallet);
    await tellor.deployed();
    await tellor.init(governance.address,oracle.address,treasury.address)
    await tellor.transfer(accounts[2].address,web3.utils.toWei("500"));
    tellorUser = await ethers.getContractAt("contracts/interfaces/IController.sol:IController",tellorMaster, accounts[2]);
    let count = await master.getNewValueCountbyRequestId(1);
    let timestamp = await master.getTimestampbyRequestIDandIndex(1,count.toNumber() - 1);
    await tellorUser.beginDispute(1,timestamp,4);
    let newId = await master.getUintVar(web3.utils.keccak256("_DISPUTE_COUNT"));
    await tellorUser.vote(newId,true);
    await h.advanceTime(86400 * 2.5)
    await tellorUser.tallyVotes(newId);
    await h.advanceTime(86400 * 2.5)
    await tellorUser.unlockDisputeFee(newId);
    await h.expectThrow(tellorUser.addTip(1,5,'0x'))
    await h.expectThrow(tellorUser.getNewVariablesOnDeck())
  }).timeout(40000);
  it("name()", async function() {
    assert(await tellor.name() == "Tellor Tributes", "name should be correct")
  });
  it("getAddressVars()", async function() {
    assert(await tellor.getAddressVars(h.hash("_GOVERNANCE_CONTRACT")) == governance.address, "Get addressVar governance should be correct")
    assert(await tellor.getAddressVars(h.hash("_OLD_TELLOR")) == "0x0Ba45A8b5d5575935B8158a88C631E9F9C95a2e5", "Get addressVar oldTellor should be correct")
    assert(await tellor.getAddressVars(h.hash("xxx"))*1 == 0, "Get addressVar nil should be correct")
  });
  it("symbol()", async function() {
    assert(await tellor.symbol() == "TRB", "symbol should be correct")
    });
  it("getUintVar()", async function() {
    assert(await tellor.getUintVar(h.hash("_STAKE_AMOUNT")) - web3.utils.toWei("100") ==0, "Get uintVar stake amount should be correct")
    assert(await tellor.getUintVar(h.hash("_SWITCH_TIME")) > 0, "Get uintVar switch time should be correct")
    assert(await tellor.getUintVar(h.hash("xxx"))*1 == 0, "Get uintVar nil should be correct")
  });
  it("totalSupply()", async function() {
    assert(await tellor.totalSupply() > web3.utils.toWei("1700000"), "total supply should be correct")
    assert(await tellor.totalSupply() < web3.utils.toWei("2700000"), "total supply should be correct")
  });
  it("getNewValueCountbyRequestId()", async function() {
    let _index = await tellor.getNewValueCountbyRequestId(1);
    assert(_index > 0 , "should get an old index")
    await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[2]);
    await tellorUser.depositStake();
    oracle2 = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[2]);
    await oracle2.submitValue(h.uintTob32(1),150,0);//clear inflationary rewards
    _index = await tellor.getNewValueCountbyRequestId(1);
    assert(_index == 1, "new index should be correct")
    await h.advanceTime(86400 * 2.5)
    await oracle2.submitValue(h.uintTob32(1),150,1);//clear inflationary rewards
    _index = await tellor.getNewValueCountbyRequestId(1);
    assert(_index == 2, "new index should be correct again")
  });
});
