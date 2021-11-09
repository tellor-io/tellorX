const { AbiCoder } = require("@ethersproject/abi");
const { expect } = require("chai");
const h = require("../../test/helpers/helpers");
var assert = require('assert');
const web3 = require('web3');
const fetch = require('node-fetch')

// Hardhat forking tests for after TellorX is deployed, before init called

describe("TellorX Function Tests - Transition", function() {

  const tellorMaster = "0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0"
  const controllerAddress = "0x45b778325ECf22E317767028a50749ff1D41E30b"
  const oracleAddress = "0xD7b3529A008d1791Ea683b6Ac909ecE309603C12"
  const governanceAddress = "0x8Db04961e0f87dE557aCB92f97d90e2A2840A468"
  const treasuryAddress = "0x2fcAb47708fcE3713fD4420A0dDD5270b5b92632"
  const DEV_WALLET = "0x2F51C4Bf6B66634187214A695be6CDd344d4e9d1"
  const PARACHUTE = "0x83eB2094072f6eD9F57d3F19f54820ee0BaE6084"
  const BIGWALLET = "0x41C5a04F61b865e084E5F502ff322aD624CaD609"
  const BIGWALLET2 = "0xa2D4728F5c0031F69160E1155d7404DCdc8C3A4e"
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
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [BIGWALLET2]}
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
    bigWallet2 = await ethers.provider.getSigner(BIGWALLET2);
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
    tellor = await ethers.getContractAt("contracts/testing/TestController.sol:TestController",tellorMaster, devWallet);
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

  it("init()", async function() {
    this.timeout(20000000)
    assert(await tellor.getAddressVars(h.hash("_GOVERNANCE_CONTRACT")) == governance.address, "Governance Address should be correct");
    assert(await tellor.getAddressVars(h.hash("_TREASURY_CONTRACT")) == treasury.address, "Governance Address should be correct");
    assert(await tellor.getAddressVars(h.hash("_ORACLE_CONTRACT")) == oracle.address, "Governance Address should be correct");
    assert(await tellor.getUintVar(h.hash("_STAKE_AMOUNT")) - h.to18(100) == 0, "stake amount should peroperly change");
    await h.expectThrow(tellor.init());
    assert(await tellor.getUintVar(h.hash("_SWITCH_TIME")) > 0, "switch time should be correct")
    assert(await tellor.balanceOf(oracle.address) - h.to18(105120) == 0, "oracle balance should be correct")
  });
  it("getTimestampbyRequestIDandIndex()", async function() {
    _index = await tellor["getNewValueCountbyRequestId(uint256)"](1);
    _t = await tellor["getTimestampbyRequestIDandIndex(uint256,uint256)"](1,_index-2);
    assert(_t > 0, "timestamp in old system should be correct")
    await tellor.transfer(accounts[3].address,web3.utils.toWei("200"));
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[3]);
    await tellorUser.depositStake();
    oracle2 = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[3]);
    await oracle2.submitValue(h.uintTob32(1),150,0,'0x');//clear inflationary rewards
    let blocky = await ethers.provider.getBlock();
    _t = await tellor["getTimestampbyRequestIDandIndex(uint256,uint256)"](1,0);
    assert(_t == blocky.timestamp, "timestamp should be correct")
  });
  it("retrieveData()", async function() {
    _index = await tellor["getNewValueCountbyRequestId(uint256)"](1);
    _t = await tellor["getTimestampbyRequestIDandIndex(uint256,uint256)"](1,_index-2);
    let rdata = await tellor["retrieveData(uint256,uint256)"](1,_t);
    assert(rdata > 0, "data must be present")
    await tellor.transfer(accounts[3].address,web3.utils.toWei("200"));
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[3]);
    await tellorUser.depositStake();
    oracle2 = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[3]);
    await oracle2.submitValue(h.uintTob32(1),150,0,'0x');//clear inflationary rewards
    _t = await tellor["getTimestampbyRequestIDandIndex(uint256,uint256)"](1,0);
    rdata = await tellor["retrieveData(uint256,uint256)"](1,_t);
    assert(rdata-150 == 0 , "data must be correct")
  });
  it("getLastNewValueById()", async function() {
    let rdata = await tellor.getLastNewValueById(1);
    assert(rdata[0] > 0, "data must be present")
    assert(rdata[1], "must get data")
    await tellor.transfer(accounts[3].address,web3.utils.toWei("200"));
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[3]);
    await tellorUser.depositStake();
    oracle2 = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[3]);
    await oracle2.submitValue(h.uintTob32(1),150,0,'0x');//clear inflationary rewards
    rdata = await tellor.getLastNewValueById(1);
    assert(rdata[0] -150 == 0 , "data must be correct")
    assert(rdata[1], "must get data")
  });
  // No "sliceUintTest" in real transition contract. Can't test
  // it("sliceUint()", async function() {
  //   await tellor.transfer(accounts[3].address,web3.utils.toWei("200"));
  //   tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[3]);
  //   await tellorUser.depositStake();
  //   oracle2 = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[3]);
  //   await oracle2.submitValue( h.uintTob32(1),150,0,'0x');//clear inflationary rewards
  //   let val = oracle.getCurrentValue(h.uintTob32(1))
  //   assert(await tellor.sliceUintTest(val) - 150 == 0, "sliceUint shoudl work properly")
  // });
  it("fallback()", async function() {
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [{forking: {
            // jsonRpcUrl: hre.config.networks.hardhat.forking.url,
            jsonRpcUrl: "https://eth-rinkeby.alchemyapi.io/v2/I-BlqR7R6s5-Skel3lnCwJzamDbmXHLF",
            blockNumber: 9074547 //fork old one (non-parachute), so we don't need upgrade process
          },},],
      });
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [DEV_WALLET]}
    )
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [BIGWALLET2]}
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
    await accounts[0].sendTransaction({to:BIGWALLET2,value:ethers.utils.parseEther("1.0")});
    const devWallet = await ethers.provider.getSigner(DEV_WALLET);
    const bigWallet2 = await ethers.provider.getSigner(BIGWALLET2);
    master = await oldTellorInstance.connect(devWallet)
    await master.changeTellorContract(controller.address)
    tellor = await ethers.getContractAt("contracts/testing/TestController.sol:TestController",tellorMaster, bigWallet2);
    await tellor.deployed();
    await tellor.init()
    await tellor.transfer(accounts[3].address,web3.utils.toWei("500"));
    tellorUser = await ethers.getContractAt("contracts/interfaces/IController.sol:IController",tellorMaster, accounts[3]);
    let count = await master.getNewValueCountbyRequestId(1);
    let timestamp = await master.getTimestampbyRequestIDandIndex(1,count.toNumber() - 1);
    await tellorUser.beginDispute(1,timestamp,4);
    let newId = await master.getUintVar(web3.utils.keccak256("_DISPUTE_COUNT"));
    newId = newId
    await tellorUser.vote(newId,true);
    await h.advanceTime(86400 * 2.5)
    await tellorUser.tallyVotes(newId);
    await h.advanceTime(86400 * 2.5)
    await tellorUser.unlockDisputeFee(newId);
    await h.expectThrow(tellorUser.tipQuery(1,5,'0x'))
    await h.expectThrow(tellorUser.getNewVariablesOnDeck())
  }).timeout(40000);
  it("name()", async function() {
    assert(await tellor.name() == "Tellor Tributes", "name should be correct")
  });
  it("decimals)", async function() {
    assert(await tellor.decimals() == 18, "decimals should be correct")
  });
  it("getAddressVars()", async function() {
    assert(await tellor.getAddressVars(h.hash("_GOVERNANCE_CONTRACT")) == governance.address, "Get addressVar governance should be correct")
    // assert(await tellor.getAddressVars(h.hash("_OLD_TELLOR")) == "0x0Ba45A8b5d5575935B8158a88C631E9F9C95a2e5", "Get addressVar oldTellor should be correct")
    assert(await tellor.getAddressVars(h.hash("_OLD_TELLOR")) == "0xFe41Cb708CD98C5B20423433309E55b53F79134a", "Get addressVar oldTellor should be correct")
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
  it("isMigrated()", async function() {
    assert(await tellor.isMigrated(BIGWALLET2) == true, "dev wallet is migrated")
    assert(await tellor.isMigrated(accounts[1].address) == false, "this account is not migrated")
  });
  it("getNewCurrentVariables()", async function() {
    await tellor.transfer(accounts[3].address,web3.utils.toWei("200"));
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[3]);
    await tellorUser.depositStake();
    oracle2 = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[3]);
    await oracle2.submitValue( h.uintTob32(2),150,0,'0x');//clear inflationary rewards
    let blocky = await ethers.provider.getBlock();
    let vars = await tellor.getNewCurrentVariables();
    assert(vars[0] == ethers.utils.solidityKeccak256(['uint256'], [blocky.timestamp]), "challenge should be correct")
    await h.advanceTime(86400)
    await oracle2.submitValue( h.uintTob32(2),150,1,'0x');//clear inflationary rewards
    blocky = await ethers.provider.getBlock();
    vars = await tellor.getNewCurrentVariables();
    assert(vars[0] == ethers.utils.solidityKeccak256(['uint256'], [blocky.timestamp]), "challenge should be correct")
  });
  it("totalSupply()", async function() {
    let totalSupply = await tellor.totalSupply()
    assert(totalSupply > web3.utils.toWei("100000"), "total supply should be correct>")
    assert(totalSupply-1 < web3.utils.toWei("1000000"), "total supply should be correct<")

  });
  it("getNewValueCountbyRequestId()", async function() {
    _index = await tellor["getNewValueCountbyRequestId(uint256)"](1);
    assert(_index > 0 , "should get an old index")
    await tellor.transfer(accounts[3].address,web3.utils.toWei("200"));
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[3]);
    await tellorUser.depositStake();
    oracle2 = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[3]);
    await oracle2.submitValue(h.uintTob32(1),150,0,'0x');//clear inflationary rewards
    _index = await tellor["getNewValueCountbyRequestId(uint256)"](1);
    assert(_index == 1, "new index should be correct")
    await h.advanceTime(86400 * 2.5)
    await oracle2.submitValue(h.uintTob32(1),150,1,'0x');//clear inflationary rewards
    _index = await tellor["getNewValueCountbyRequestId(uint256)"](1);
    assert(_index == 2, "new index should be correct again")
  });

  it("getAllDisputeVars()", async function() {
    this.timeout(20000000)
        const directors = await fetch('https://api.blockcypher.com/v1/eth/main').then(response => response.json());
        mainnetBlock = directors.height - 15;
        console.log("     Forking from block: ",mainnetBlock)
      accounts = await ethers.getSigners();
      await hre.network.provider.request({
        method: "hardhat_reset",
        params: [{forking: {
              // jsonRpcUrl: hre.config.networks.hardhat.forking.url,
              jsonRpcUrl: "https://eth-rinkeby.alchemyapi.io/v2/I-BlqR7R6s5-Skel3lnCwJzamDbmXHLF",
              // blockNumber: mainnetBlock
              blockNumber: 9609165
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
      await master.transfer(accounts[3].address,web3.utils.toWei("500"));
      let count = await master.getNewValueCountbyRequestId(1);
      let timestamp = await master.getTimestampbyRequestIDandIndex(1,count.toNumber() - 1);
      tellorUser = await ethers.getContractAt("contracts/interfaces/IController.sol:IController",tellorMaster, accounts[3]);
      let dispBal1 = await master.balanceOf(accounts[3].address)
      await tellorUser.beginDispute(1,timestamp,4);
      let blocky = await ethers.provider.getBlock();
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
      assert(dispVars[8] - await tellor.balanceOf(accounts[3].address) == 0, "tally should be correct")
      await h.advanceTime(86400 * 2.5)
      await tellorUser.tallyVotes(newId);
      dispVars = await tellor.getAllDisputeVars(newId)
      assert(dispVars[2], "vote should have passed")
      await h.advanceTime(86400 * 2.5)
      await tellorUser.unlockDisputeFee(newId);
      dispVars = await tellor.getAllDisputeVars(newId);
      assert(dispVars[1] == true, "vote should be executed")
      assert(dispVars[2] == true, "vote should have passed")
      assert(dispVars[3] == false, "vote should not be proposed fork")
      assert(dispVars[5] == accounts[3].address, "reporting party should be correct")
      assert(dispVars[6] == "0x0000000000000000000000000000000000000000", "proposed fork address should be zero")
      assert(dispVars[7][0] == 1, "disputed request id should be correct")
      tsdiff = dispVars[7][1] - timestamp
      assert(tsdiff == 0, "disputed timestamp should be correct")
      assert(dispVars[7][2] > 0, "disputed value should be correct")
      assert(dispVars[7][4] == 1, "Vote count should be correct")
      blockdiff = dispVars[7][5] - blocky.number
      assert(blockdiff == 0, "block number should be correct")
      assert(dispVars[7][6] == 4, "miner slot should be correct")
      assert(dispVars[7][7] == 0, "quorum should be correct")
      assert(await tellor.getDisputeUintVars(newId, "0x9f47a2659c3d32b749ae717d975e7962959890862423c4318cf86e4ec220291f") == 1, "request ID should be retrieved correctly")
      idDiff = await tellor.getDisputeIdByDisputeHash(dispVars[0]) - newId
      assert(idDiff == 0, "dispute id should be retrieved correctly")
  })
});
