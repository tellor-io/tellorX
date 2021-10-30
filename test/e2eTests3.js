const { AbiCoder } = require("@ethersproject/abi");
const { expect } = require("chai");
const h = require("./helpers/helpers");
var assert = require('assert');
const web3 = require('web3');
const { ethers } = require("hardhat");
const { stakeAmount } = require("./helpers/helpers");
const { keccak256 } = require("ethers/lib/utils");

describe("End-to-End Tests - Three", function() {

  const tellorMaster = "0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0"
  const DEV_WALLET = "0x39E419bA25196794B595B2a595Ea8E527ddC9856"
  const PARACHUTE = "0x83eB2094072f6eD9F57d3F19f54820ee0BaE6084"
  const BIGWALLET = "0xf977814e90da44bfa03b6295a0616a897441acec";
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
            jsonRpcUrl: hre.config.networks.hardhat.forking.url,
            blockNumber:13147399

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
    await accounts[1].sendTransaction({to:governance.address,value:ethers.utils.parseEther("2.0")});
    govSigner = await ethers.provider.getSigner(governance.address);
    });

  it("Test a valid vote on every approved function", async function() {
    this.timeout(20000000)
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[1]);
    await tellor.connect(bigWallet).transfer(accounts[1].address,await tellor.balanceOf(BIGWALLET));
    let voteCount;

    // ****************************************
    // * changeControllerContract(address)
    // ****************************************
    let newController = await cfac.deploy(governance.address, oracle.address, treasury.address);
    await newController.deployed();
    proposalData = ethers.utils.hexZeroPad(newController.address, 32);
    await governance.proposeVote(tellorMaster, 0x3c46a185, proposalData, 0);
    voteCount = await governance.voteCount();
    await governance.vote(voteCount, true, false);
    await h.advanceTime(604800);
    await governance.tallyVotes(voteCount);
    await h.advanceTime(86400);
    await governance.executeVote(voteCount);
    tellorUser = await ethers.getContractAt("contracts/Controller.sol:Controller", controller.address, accounts[1]);
    assert(await tellor.getAddressVars(h.hash("_TELLOR_CONTRACT")) == newController.address, "Controller contract address variable should be correct");

    // ****************************************
    // * changeGovernanceContract(address)
    // ****************************************
    let newGovernance = await gfac.deploy();
    await newGovernance.deployed();
    proposalData = ethers.utils.hexZeroPad(newGovernance.address, 32);
    await governance.proposeVote(tellorMaster, 0xe8ce51d7, proposalData, 0);
    voteCount = await governance.voteCount();
    await governance.vote(voteCount, true, false);
    await h.advanceTime(604800);
    await governance.tallyVotes(voteCount);
    await h.advanceTime(86400);
    await governance.executeVote(voteCount);
    assert(await tellor.getAddressVars(h.hash("_GOVERNANCE_CONTRACT")) == newGovernance.address, "Governance contract address variable should be correct");
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",newGovernance.address, accounts[1]); // set to new governance contract address

    // ****************************************
    // * changeOracleContract(address)
    // ****************************************
    let newOracle = await ofac.deploy();
    await newOracle.deployed();
    proposalData = ethers.utils.hexZeroPad(newOracle.address, 32);
    await governance.proposeVote(tellorMaster, 0x1cbd3151, proposalData, 0);
    voteCount = await governance.voteCount();
    await governance.vote(voteCount, true, false);
    await h.advanceTime(604800);
    await governance.tallyVotes(voteCount);
    await h.advanceTime(86400);
    await governance.executeVote(voteCount);
    assert(await tellor.getAddressVars(h.hash("_ORACLE_CONTRACT")) == newOracle.address, "Oracle contract address variable should be correct");
    oracle = await ethers.getContractAt("contracts/Oracle.sol:Oracle",newOracle.address, accounts[1]); // set to new oracle contract address

    // ****************************************
    // * changeTreasuryContract(address)
    // ****************************************
    let newTreasury = await tfac.deploy();
    await newTreasury.deployed();
    proposalData = ethers.utils.hexZeroPad(newTreasury.address, 32);
    await governance.proposeVote(tellorMaster, 0xbd87e0c9, proposalData, 0);
    voteCount = await governance.voteCount();
    await governance.vote(voteCount, true, false);
    await h.advanceTime(604800);
    await governance.tallyVotes(voteCount);
    await h.advanceTime(86400);
    await governance.executeVote(voteCount);
    assert(await tellor.getAddressVars(h.hash("_TREASURY_CONTRACT")) == newTreasury.address, "Treasury contract address variable should be correct");
    treasury = await ethers.getContractAt("contracts/Treasury.sol:Treasury",newTreasury.address, accounts[1]); // set to new treasury contract address

    // ****************************************
    // * changeUint(bytes32,uint256)
    // ****************************************
    await governance.proposeVote(tellorMaster, 0x740358e6, "0x5d9fadfc729fd027e395e5157ef1b53ef9fa4a8f053043c5f159307543e7cc9700000000000000000000000000000000000000000000000ad78ebc5ac6200000", 0);
    voteCount = await governance.voteCount();
    await governance.vote(voteCount, true, false);
    await h.advanceTime(604800);
    await governance.tallyVotes(voteCount);
    await h.advanceTime(86400);
    await governance.executeVote(voteCount);
    assert(await tellor.getUintVar(h.hash("_STAKE_AMOUNT")) == web3.utils.toWei("200"), "Stake amount uint should be correct");

    // ****************************************
    // * mint(address,uint256)
    // ****************************************
    await governance.proposeVote(tellorMaster, 0x40c10f19, "0x000000000000000000000000b9dD5AfD86547Df817DA2d0Fb89334A6F8eDd89100000000000000000000000000000000000000000000000ad78ebc5ac6200000", 0);
    voteCount = await governance.voteCount();
    await governance.vote(voteCount, true, false);
    await h.advanceTime(604800);
    await governance.tallyVotes(voteCount);
    await h.advanceTime(86400);
    await governance.executeVote(voteCount);
    assert(await tellor.balanceOf(accounts[2].address) == web3.utils.toWei("200"), "User balance should be correct");

    // ****************************************
    // * setApprovedFunction(bytes4,bool)
    // ****************************************
    // approve the token contract's 'approve(address,uint256)' function
    await governance.proposeVote(governance.address, 0xe48d4b3b, "0x095ea7b3000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001", 0);
    voteCount = await governance.voteCount();
    await governance.vote(voteCount, true, false);
    await h.advanceTime(604800);
    await governance.tallyVotes(voteCount);
    await h.advanceTime(86400);
    await governance.executeVote(voteCount);
    assert(await governance.isFunctionApproved(0x095ea7b3), "Function should be approved");
    await governance.proposeVote(tellorMaster, 0x095ea7b3, "0x000000000000000000000000b9dD5AfD86547Df817DA2d0Fb89334A6F8eDd89100000000000000000000000000000000000000000000000ad78ebc5ac6200000", 0);
    voteCount = await governance.voteCount();
    await governance.vote(voteCount, true, false);
    await h.advanceTime(604800);
    await governance.tallyVotes(voteCount);
    await h.advanceTime(86400);
    await governance.executeVote(voteCount);
    assert(await tellor.allowance(governance.address,accounts[2].address) == web3.utils.toWei("200"), "Governance allowance should be correct");

    // ****************************************
    // * changeTypeInformation(uint256,uint256,uint256)
    // ****************************************
    // NOTE: This function not in codebase?

    // ****************************************
    // * changeReportingLock(uint256)
    // ****************************************
    await governance.proposeVote(oracle.address, 0x5d183cfa, "0x0000000000000000000000000000000000000000000000000000000000000018", 0);
    voteCount = await governance.voteCount();
    await governance.vote(voteCount, true, false);
    await h.advanceTime(604800);
    await governance.tallyVotes(voteCount);
    await h.advanceTime(86400);
    await governance.executeVote(voteCount);
    assert(await oracle.reportingLock() == 24, "Reporting lock should be correct");

    // ****************************************
    // * changeTimeBasedReward(uint256)
    // ****************************************
    await governance.proposeVote(oracle.address, 0x6d53585f, "0x0000000000000000000000000000000000000000000000000853a0d2313c0000", 0);
    voteCount = await governance.voteCount();
    await governance.vote(voteCount, true, false);
    await h.advanceTime(604800);
    await governance.tallyVotes(voteCount);
    await h.advanceTime(86400);
    await governance.executeVote(voteCount);
    assert(await oracle.getTimeBasedReward() == 600000000000000000, "Time based reward should be correct");

    // ****************************************
    // * issueTreasury(uint256,uint256,uint256)
    // ****************************************
    await governance.proposeVote(treasury.address, 0x6274885f, "0x00000000000000000000000000000000000000000000003635c9adc5dea0000000000000000000000000000000000000000000000000000000000000000001f400000000000000000000000000000000000000000000000000000000002dc6c0", 0);
    voteCount = await governance.voteCount();
    await governance.vote(voteCount, true, false);
    await h.advanceTime(604800);
    await governance.tallyVotes(voteCount);
    await h.advanceTime(86400);
    await governance.executeVote(voteCount);
    let treasuryDetails = await treasury.getTreasuryDetails(1);
    assert(treasuryDetails[1] == web3.utils.toWei("1000"), "Treasury amount should be correct");
    assert(treasuryDetails[2] == 500, "Treasury rate should be correct");
  });

  it("Upgrade Governance Contract", async function() {
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[1]);
    await tellor.connect(bigWallet).transfer(accounts[1].address,await tellor.balanceOf(BIGWALLET));
    let voteCount;
    let newGovernance = await gfac.deploy();
    await newGovernance.deployed();
    proposalData = ethers.utils.hexZeroPad(newGovernance.address, 32);
    await governance.proposeVote(tellorMaster, 0xe8ce51d7, proposalData, 0);
    voteCount = await governance.voteCount();
    await governance.vote(voteCount, true, false);
    await h.advanceTime(604800);
    await governance.tallyVotes(voteCount);
    await h.advanceTime(86400);
    await governance.executeVote(voteCount);
    assert(await tellor.getAddressVars(h.hash("_GOVERNANCE_CONTRACT")) == newGovernance.address, "Governance contract address variable should be correct");
  });

  it("Upgrade Oracle Contract", async function() {
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[1]);
    await tellor.connect(bigWallet).transfer(accounts[1].address,await tellor.balanceOf(BIGWALLET));
    let voteCount;
    let newOracle = await ofac.deploy();
    await newOracle.deployed();
    proposalData = ethers.utils.hexZeroPad(newOracle.address, 32);
    await governance.proposeVote(tellorMaster, 0x1cbd3151, proposalData, 0);
    voteCount = await governance.voteCount();
    await governance.vote(voteCount, true, false);
    await h.advanceTime(604800);
    await governance.tallyVotes(voteCount);
    await h.advanceTime(86400);
    await governance.executeVote(voteCount);
    assert(await tellor.getAddressVars(h.hash("_ORACLE_CONTRACT")) == newOracle.address, "Oracle contract address variable should be correct");
  });

  it("Test  a valid vote on a valid function but that reverts (invalid data)", async function() {
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[1]);
    await tellor.connect(bigWallet).transfer(accounts[1].address,await tellor.balanceOf(BIGWALLET));
    let voteCount;
    let tofac = await ethers.getContractFactory("contracts/testing/TestToken.sol:TestToken");
    let newToken = await tofac.deploy();
    await newToken.deployed();
    proposalData = ethers.utils.hexZeroPad(newToken.address, 32); // Invalid contract address, no verify() function
    await governance.proposeVote(tellorMaster, 0x3c46a185, proposalData, 0); //propose changeControllerContract(address)
    voteCount = await governance.voteCount();
    await governance.vote(voteCount, true, false);
    await h.advanceTime(604800);
    await governance.tallyVotes(voteCount);
    await h.advanceTime(86400);
    await governance.executeVote(voteCount);
    assert(await tellor.getAddressVars(h.hash("_TELLOR_CONTRACT")) == controller.address, "Controller contract address variable should be correct");
  });

  it("Test  a valid vote on an invalid function", async function() {
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[1]);
    await tellor.connect(bigWallet).transfer(accounts[1].address,await tellor.balanceOf(BIGWALLET));
    admin = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, govSigner);
    await admin.setApprovedFunction(0x1a434191, true); //invalid function: changeTreasuryContracts(address)
    let voteCount;
    let newTreasury = await tfac.deploy();
    await newTreasury.deployed();
    proposalData = ethers.utils.hexZeroPad(newTreasury.address, 32);
    await governance.proposeVote(tellorMaster, 0x1a434191, proposalData, 0);
    voteCount = await governance.voteCount();
    await governance.vote(voteCount, true, false);
    await h.advanceTime(604800);
    await governance.tallyVotes(voteCount);
    await h.advanceTime(86400);
    await governance.executeVote(voteCount);
    assert(await tellor.getAddressVars(h.hash("_TREASURY_CONTRACT")) == treasury.address, "Treasury contract address variable should be correct");
    let voteInfo = await governance.getVoteInfo(voteCount);
    assert(voteInfo[2][0], "Vote should be executed");
  });

  it("Test invalid vote result", async function() {
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[1]);
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[2]);
    oracle = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[2]);
    // admin = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, govSigner);
    // await admin.mint(accounts[1].address, web3.utils.toWei("200000"));
    // await admin.mint(accounts[2].address, web3.utils.toWei("100"));
    await tellor.connect(bigWallet).transfer(accounts[2].address, web3.utils.toWei("100"));
    await tellor.connect(bigWallet).transfer(accounts[1].address,await tellor.balanceOf(BIGWALLET));
    await tellorUser.depositStake();
    await oracle.submitValue(h.uintTob32(1),300,0,'0x');
    let _t = await oracle.getReportTimestampByIndex(h.uintTob32(1),0);
    await governance.beginDispute(h.uintTob32(1),_t);
    voteCount = await governance.voteCount();
    await governance.vote(voteCount, false, true);
    await h.advanceTime(604800);
    await governance.tallyVotes(voteCount);
    await h.advanceTime(86400);
    let disputerBal0 = await tellorUser.balanceOf(accounts[1].address);
    await governance.executeVote(voteCount);
    let disputerBal1 = await tellorUser.balanceOf(accounts[1].address);
    let voteInfo = await governance.getVoteInfo(voteCount);
    let fee = voteInfo[1][3];
    let sum = disputerBal0.add(fee);
    assert(sum.eq(disputerBal1), "Disputer balance should be correct");
    assert(voteInfo[2][0], "Vote should be executed");
    assert(voteInfo[3] == 2, "Vote result should be correct");
    let reporterBal = await tellorUser.balanceOf(accounts[2].address);
    assert(reporterBal >= web3.utils.toWei("100"), "Reporter balance should be correct");
    let stakerInfo = await tellorUser.getStakerInfo(accounts[2].address);
    assert(stakerInfo[0] == 1, "Staker info should be correct");
  });

  it("Test multiple rounds ending in an invalid vote result", async function() {
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[1]);
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[2]);
    oracle = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[2]);
    admin = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, govSigner);
    await admin.mint(accounts[1].address, web3.utils.toWei("200000"));
    await admin.mint(accounts[2].address, web3.utils.toWei("100"));
    await tellorUser.depositStake();
    await oracle.submitValue(h.uintTob32(1),300,0,'0x');
    let _t = await oracle.getReportTimestampByIndex(h.uintTob32(1),0);
    // Round 1
    await governance.beginDispute(h.uintTob32(1),_t);
    voteCount = await governance.voteCount();
    await governance.vote(voteCount, false, true);
    await h.advanceTime(604800);
    await governance.tallyVotes(voteCount);
    // Round 2
    await governance.beginDispute(h.uintTob32(1),_t);
    voteCount = await governance.voteCount();
    await governance.vote(voteCount, false, true);
    await h.advanceTime(604800);
    await governance.tallyVotes(voteCount);
    // Round 3
    await governance.beginDispute(h.uintTob32(1),_t);
    voteCount = await governance.voteCount();
    await governance.vote(voteCount, false, true);
    await h.advanceTime(604800);
    await governance.tallyVotes(voteCount);
    await h.advanceTime(86400*3);
    let disputerBal0 = await tellorUser.balanceOf(accounts[1].address);
    await governance.executeVote(voteCount);
    let disputerBal1 = await tellorUser.balanceOf(accounts[1].address);
    let voteInfo1 = await governance.getVoteInfo(1);
    let voteInfo2 = await governance.getVoteInfo(2);
    let voteInfo3 = await governance.getVoteInfo(3);
    let fee = voteInfo1[1][3].add(voteInfo2[1][3].add(voteInfo3[1][3]));
    let sum = disputerBal0.add(fee);
    assert(sum.eq(disputerBal1), "Disputer balance should be correct");
    assert(voteInfo3[2][0], "Vote should be executed");
    assert(voteInfo3[3] == 2, "Vote result should be correct");
    let reporterBal = await tellorUser.balanceOf(accounts[2].address);
    assert(reporterBal >= web3.utils.toWei("100"), "Reporter balance should be correct");
    let stakerInfo = await tellorUser.getStakerInfo(accounts[2].address);
    assert(stakerInfo[0] == 1, "Staker info should be correct");
  });

  it("Test multiple vote rounds on an ID", async function() {
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[1]);
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[2]);
    oracle = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[2]);
    admin = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, govSigner);
    await admin.mint(accounts[1].address, web3.utils.toWei("200000"));
    await admin.mint(accounts[2].address, web3.utils.toWei("100"));
    await tellorUser.depositStake();
    await oracle.submitValue(h.uintTob32(1),300,0,'0x');
    let _t = await oracle.getReportTimestampByIndex(h.uintTob32(1),0);
    // Round 1
    await governance.beginDispute(h.uintTob32(1),_t);
    voteCount = await governance.voteCount();
    await governance.vote(voteCount, false, false);
    await h.advanceTime(604800);
    await governance.tallyVotes(voteCount);
    // Round 2
    await governance.beginDispute(h.uintTob32(1),_t);
    voteCount = await governance.voteCount();
    await governance.vote(voteCount, true, false);
    await h.advanceTime(604800);
    await governance.tallyVotes(voteCount);
    // Round 3
    await governance.beginDispute(h.uintTob32(1),_t);
    voteCount = await governance.voteCount();
    await governance.vote(voteCount, true, false);
    await h.advanceTime(604800);
    await governance.tallyVotes(voteCount);
    await h.advanceTime(86400*3);
    let disputerBal0 = await tellorUser.balanceOf(accounts[1].address);
    reporterBal0 = await tellor.balanceOf(accounts[2].address)
    await governance.executeVote(voteCount);
    let disputerBal1 = await tellorUser.balanceOf(accounts[1].address);
    let voteInfo1 = await governance.getVoteInfo(1);
    let voteInfo2 = await governance.getVoteInfo(2);
    let voteInfo3 = await governance.getVoteInfo(3);
    let fee = voteInfo1[1][3].add(voteInfo2[1][3].add(voteInfo3[1][3]));
    let sum = disputerBal0.add(fee.add(web3.utils.toWei("100")));
    assert(sum.eq(disputerBal1), "Disputer balance should be correct");
    assert(voteInfo3[2][0], "Vote should be executed");
    assert(voteInfo3[3] == 1, "Vote result should be correct");
    let reporterBal1 = await tellorUser.balanceOf(accounts[2].address);
    assert(reporterBal1 == reporterBal0 - web3.utils.toWei("100"), "Reporter balance should be correct");
    let stakerInfo = await tellorUser.getStakerInfo(accounts[2].address);
    assert(stakerInfo[0] == 5, "Staker info should be correct");
  });

  it("Ensure no votes on a dispute means invalid and on a function vote is failed", async function() {
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[1]);
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[2]);
    oracle = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[2]);
    admin = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, govSigner);
    await admin.mint(accounts[1].address, web3.utils.toWei("200000"));
    await admin.mint(accounts[2].address, web3.utils.toWei("100"));
    // No votes on dispute
    await tellorUser.depositStake();
    await oracle.submitValue(h.uintTob32(1),300,0,'0x');
    let _t = await oracle.getReportTimestampByIndex(h.uintTob32(1),0);
    let reporterBal0 = await tellorUser.balanceOf(accounts[2].address);
    await governance.beginDispute(h.uintTob32(1),_t);
    voteCount = await governance.voteCount();
    await h.advanceTime(604800);
    await governance.tallyVotes(voteCount);
    await h.advanceTime(86400);
    let disputerBal0 = await tellorUser.balanceOf(accounts[1].address);
    await governance.executeVote(voteCount);
    let disputerBal1 = await tellorUser.balanceOf(accounts[1].address);
    let voteInfo = await governance.getVoteInfo(voteCount);
    let fee = voteInfo[1][3];
    let sum = disputerBal0.add(fee);
    assert(sum.eq(disputerBal1), "Disputer balance should be correct");
    assert(voteInfo[2][0], "Vote should be executed");
    assert(voteInfo[3] == 2, "Vote result should be correct");
    let reporterBal1 = await tellorUser.balanceOf(accounts[2].address);
    assert(reporterBal1.eq(reporterBal0), "Reporter balance should be correct");
    let stakerInfo = await tellorUser.getStakerInfo(accounts[2].address);
    assert(stakerInfo[0] == 1, "Staker info should be correct");
    assert(voteInfo[1][5] == 0, "Quantity of votes for should be correct");
    assert(voteInfo[1][6] == 0, "Quantity of votes against should be correct");
    assert(voteInfo[1][7] == 0, "Quantity of votes invalid should be correct");
    // No votes on function vote
    let newOracle = await ofac.deploy();
    await newOracle.deployed();
    proposalData = ethers.utils.hexZeroPad(newOracle.address, 32);
    await governance.proposeVote(tellorMaster, 0x1cbd3151, proposalData, 0);
    voteCount = await governance.voteCount();
    await h.advanceTime(604800);
    await governance.tallyVotes(voteCount);
    await h.advanceTime(86400);
    await governance.executeVote(voteCount);
    assert(await tellor.getAddressVars(h.hash("_ORACLE_CONTRACT")) == oracle.address, "Oracle contract address variable should be correct");
    voteInfo = await governance.getVoteInfo(voteCount);
    assert(voteInfo[3] == 0, "Vote result should be correct");
  });

  it("Treasury buyer votes 2/3 times, does the treasury reward math check out?", async function() {
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[1]);
    admin = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, govSigner);
    treasGov = await ethers.getContractAt("contracts/Treasury.sol:Treasury",treasury.address, govSigner);
    treasury = await ethers.getContractAt("contracts/Treasury.sol:Treasury",treasury.address, accounts[1]);
    await admin.mint(accounts[1].address, web3.utils.toWei("130"));
    let voteCount;
    let treasDuration = 2592000;
    let treasRate = 700;
    let treasAmount = web3.utils.toWei("100");
    await treasGov.issueTreasury(web3.utils.toWei("100"),treasRate,treasDuration);
    await treasury.buyTreasury(1,web3.utils.toWei("100"));
    let newGovernance = await gfac.deploy();
    // Proposal 1
    await newGovernance.deployed();
    proposalData = ethers.utils.hexZeroPad(newGovernance.address, 32);
    await governance.proposeVote(tellorMaster, 0xe8ce51d7, proposalData, 0);
    voteCount = await governance.voteCount();
    await governance.vote(voteCount, true, false);
    // Proposal 2
    await governance.proposeVote(tellorMaster, 0xe8ce51d7, proposalData, 0);
    voteCount = await governance.voteCount();
    await governance.vote(voteCount, true, false);
    // Proposal 3
    await governance.proposeVote(tellorMaster, 0xe8ce51d7, proposalData, 0);
    voteCount = await governance.voteCount();
    await h.advanceTime(treasDuration);
    await treasury.payTreasury(accounts[1].address,1);
    let realBal = await tellor.balanceOf(accounts[1].address);
    treasAmount = ethers.BigNumber.from(treasAmount);
    let expectedBal = treasAmount.mul(treasRate).div(10000).mul(2).div(3).add(treasAmount);
    assert(realBal.eq(expectedBal), "User balance should be correct");
  });

});
