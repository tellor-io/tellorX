const { AbiCoder } = require("@ethersproject/abi");
const { expect } = require("chai");
const h = require("./helpers/helpers");
var assert = require('assert');
const web3 = require('web3');

describe("End-to-End Tests - Three", function() {

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
  it("Test a valid vote on every approved function", async function() {
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[1]);
    admin = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, govSigner);
    await admin.mint(accounts[1].address, web3.utils.toWei("200000"));
    let voteCount;

    // ****************************************
    // * changeControllerContract(address)
    // ****************************************
    let newController = await cfac.deploy();
    await newController.deployed();
    await governance.proposeVote(tellorMaster, 0x3c46a185, "0x000000000000000000000000d9Ad0E4E18F2430719E73b2f824C54CFA5D703b6", 0);
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
    await governance.proposeVote(tellorMaster, 0xe8ce51d7, "0x0000000000000000000000002B63d6e98E66C7e9fe11225Ba349B0B33234D9A2", 0);
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
    await governance.proposeVote(tellorMaster, 0x1cbd3151, "0x000000000000000000000000729b7E8D2021F888015416d53b9d82666ec94469", 0);
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
    await governance.proposeVote(tellorMaster, 0xbd87e0c9, "0x000000000000000000000000aAC692b4F235B14C855F50f7068944AFe5b75A95", 0);
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
    // * changeMiningLock(uint256)
    // ****************************************
    await governance.proposeVote(oracle.address, 0xe280e8e8, "0x0000000000000000000000000000000000000000000000000000000000000018", 0);
    voteCount = await governance.voteCount();
    await governance.vote(voteCount, true, false);
    await h.advanceTime(604800);
    await governance.tallyVotes(voteCount);
    await h.advanceTime(86400);
    await governance.executeVote(voteCount);
    assert(await oracle.miningLock() == 24, "Mining lock should be correct");

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

    // ****************************************
    // * delegateVotingPower(address)
    // ****************************************
    await governance.proposeVote(treasury.address, 0xf3ff955a, "0x000000000000000000000000b9dD5AfD86547Df817DA2d0Fb89334A6F8eDd891", 0);
    voteCount = await governance.voteCount();
    await governance.vote(voteCount, true, false);
    await h.advanceTime(604800);
    await governance.tallyVotes(voteCount);
    await h.advanceTime(86400);
    await governance.executeVote(voteCount);
    let blockNumber = await ethers.provider.getBlockNumber();
    assert(await governance.delegateOfAt(treasury.address, blockNumber) == accounts[2].address, "Delegate should be correct")
  });
});
