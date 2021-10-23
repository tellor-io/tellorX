const { AbiCoder } = require("@ethersproject/abi");
const { expect } = require("chai");
const h = require("./helpers/helpers");
var assert = require('assert');
const web3 = require('web3');
const fetch = require('node-fetch')

describe("TellorX Function Tests - Controller", function() {

    const tellorMaster = "0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0"
    const DEV_WALLET = "0x39E419bA25196794B595B2a595Ea8E527ddC9856"
    const BIGWALLET = "0xf977814e90da44bfa03b6295a0616a897441acec";
    let accounts = null
    let tellor = null
    let cfac,ofac,tfac,gfac,devWallet
    let govSigner = null
    let run = 0;
    let mainnetBlock = 0;

  beforeEach("deploy and setup TellorX", async function() {
    this.timeout(20000000)
    if(run == 0){
      const directors = await fetch('https://api.blockcypher.com/v1/eth/main').then(response => response.json());
      mainnetBlock = directors.height - 20;
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
    tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, devWallet);
    await tellor.deployed();
    await tellor.init()
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [governance.address]}
    )
    await accounts[1].sendTransaction({to:governance.address,value:ethers.utils.parseEther("1.0")});
    govSigner = await ethers.provider.getSigner(governance.address);
  });
  it("getNewValueCountbyQueryId()", async function() {
    this.timeout(20000000)
    await tellor.transfer(accounts[10].address,web3.utils.toWei("100"))
    await tellor.connect(accounts[10]).depositStake()
    await oracle.connect(accounts[10]).submitValue(h.uintTob32(1),h.uintTob32(940000),0,'0x')
    val = await tellor["getNewValueCountbyQueryId(bytes32)"](h.uintTob32(1));
    assert(val == 1, "Value should be retrieved correctly")
    await h.advanceTime(60*60*12)
    await oracle.connect(accounts[10]).submitValue(h.uintTob32(1),h.uintTob32(950000),1,'0x')
    val = await tellor["getNewValueCountbyQueryId(bytes32)"](h.uintTob32(1));
    assert(val == 2, "Value should be retrieved correctly")
  });
  it("retrieveData()", async function() {
    this.timeout(20000000)
    await tellor.transfer(accounts[10].address,web3.utils.toWei("100"))
    await tellor.connect(accounts[10]).depositStake()
    await oracle.connect(accounts[10]).submitValue(h.uintTob32(1),h.uintTob32(940000),0,'0x')
    let blocky = await ethers.provider.getBlock()
    val = await tellor["retrieveData(bytes32,uint256)"](h.uintTob32(1), blocky.timestamp);
    assert(val == h.uintTob32(940000), "Data should be retrieved correctly")
    await h.advanceTime(60*60*12)
    await oracle.connect(accounts[10]).submitValue(h.uintTob32(1),h.uintTob32(950000),1,'0x')
    blocky = await ethers.provider.getBlock()
    val = await tellor["retrieveData(bytes32,uint256)"](h.uintTob32(1), blocky.timestamp);
    assert(val == h.uintTob32(950000), "Data should be retrieved correctly")
  });
  it("getTimestampbyQueryIdandIndex()", async function() {
    this.timeout(20000000)
    await tellor.transfer(accounts[10].address,web3.utils.toWei("100"))
    await tellor.connect(accounts[10]).depositStake()
    await oracle.connect(accounts[10]).submitValue(h.uintTob32(1),h.uintTob32(940000),0,'0x')
    let blocky = await ethers.provider.getBlock()
    val = await tellor["getTimestampbyQueryIdandIndex(bytes32,uint256)"](h.uintTob32(1), 0);
    assert(val == blocky.timestamp, "Timestamp should be retrieved correctly")
    await h.advanceTime(60*60*12)
    await oracle.connect(accounts[10]).submitValue(h.uintTob32(1),h.uintTob32(950000),1,'0x')
    blocky = await ethers.provider.getBlock()
    val = await tellor["getTimestampbyQueryIdandIndex(bytes32,uint256)"](h.uintTob32(1), 1)
    assert(val == blocky.timestamp, "Timestamp should be retrieved correctly")
  });
});
