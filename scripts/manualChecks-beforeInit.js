require("hardhat-gas-reporter");
require('hardhat-contract-sizer');
require("solidity-coverage");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("dotenv").config();
const web3 = require("web3");
const h = require("../test/helpers/helpers");

//npx hardhat run scripts/manualChecks-beforeInit.js --network rinkeby

// Update these variables before running script
const masterAddress = "0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0"
const controllerAddress = "0x45b778325ECf22E317767028a50749ff1D41E30b"
const oracleAddress = "0xD7b3529A008d1791Ea683b6Ac909ecE309603C12"
const governanceAddress = "0x8Db04961e0f87dE557aCB92f97d90e2A2840A468"
const treasuryAddress = "0x2fcAb47708fcE3713fD4420A0dDD5270b5b92632"
etherPrice = 4500000000
amplPrice = 1500000
expectedDisputeCount = 10

// Don't change these
let passCount = 0
let failCount = 0

async function manualChecks(_network, _pk, _pk2, _nodeURL) {
    await run("compile")
    await run("compile")

    var net = _network

    ///////////////Connect to the network
    let privateKey = _pk;
    let privateKey2 = _pk2;
    var provider = new ethers.providers.JsonRpcProvider(_nodeURL)
    let wallet = new ethers.Wallet(privateKey, provider)
    let wallet2 = new ethers.Wallet(privateKey2, provider)

    master = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor", masterAddress)
    controller = await ethers.getContractAt("contracts/Controller.sol:Controller", controllerAddress)
    oracle = await ethers.getContractAt("contracts/Oracle.sol:Oracle", oracleAddress)
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance", governanceAddress)
    treasury = await ethers.getContractAt("contracts/Treasury.sol:Treasury", treasuryAddress)



    // *************************************
    // *
    // * Before init()
    // *
    // *************************************
    console.log("\nBefore init checks:");

    // Check values of all storage variables
    console.log("Checking values of all storage variables...");
    // Controller storage
    console.log("\nChecking controller contract storage...");
    verifyEquals(await controller.addresses("0xefa19baa864049f50491093580c5433e97e8d5e41f8db1a61108b4fa44cacd93"), governance.address, "_GOVERNANCE_CONTRACT address")
    verifyEquals(await controller.addresses("0xfa522e460446113e8fd353d7fa015625a68bc0369712213a42e006346440891e"), oracle.address, "_ORACLE_CONTRACT address")
    verifyEquals(await controller.addresses("0x1436a1a60dca0ebb2be98547e57992a0fa082eb479e7576303cbd384e934f1fa"), treasury.address, "_TREASURY_CONTRACT address")

    // Governance storage
    console.log("\nChecking governance contract storage...");
    verifyEquals(await governance.isFunctionApproved("0x3c46a185"), true, "changeControllerContract(address) approval")
    verifyEquals(await governance.isFunctionApproved("0xe8ce51d7"), true, "changeGovernanceContract(address) approval")
    verifyEquals(await governance.isFunctionApproved("0x1cbd3151"), true, "changeOracleContract(address) approval")
    verifyEquals(await governance.isFunctionApproved("0xbd87e0c9"), true, "changeTreasuryContract(address) approval")
    verifyEquals(await governance.isFunctionApproved("0x740358e6"), true, "changeUint(bytes32,uint256) approval")
    verifyEquals(await governance.isFunctionApproved("0x40c10f19"), true, "mint(address,uint256) approval")
    verifyEquals(await governance.isFunctionApproved("0xe48d4b3b"), true, "setApprovedFunction(bytes4,bool) approval")
    verifyEquals(await governance.isFunctionApproved("0x5d183cfa"), true, "changeReportingLock(uint256) approval")
    verifyEquals(await governance.isFunctionApproved("0x6d53585f"), true, "changeTimeBasedReward(uint256) approval")
    verifyEquals(await governance.isFunctionApproved("0x6274885f"), true, "issueTreasury(uint256,uint256,uint256) approval")
    verifyEquals(await governance.voteCount(), 0, "voteCount")
    verifyGreaterThan(await governance.disputeFee(), 0, "disputeFee")

    // Oracle storage
    console.log("\nChecking oracle contract storage...");
    verifyEquals(await oracle.reportingLock(), 60*60*12, "reportingLock")
    verifyEquals(await oracle.timeBasedReward(), "500000000000000000", "timeBasedReward")
    verifyGreaterThan(await oracle.timeOfLastNewValue(), 0, "timeOfLastNewValue")
    verifyEquals(await oracle.tipsInContract(), 0, "tipsInContract")

    // Treasury storage
    console.log("\nChecking treasury contract storage...");
    verifyEquals(await treasury.totalLocked(), 0, "totalLocked")
    verifyEquals(await treasury.treasuryCount(), 0, "treasuryCount")

    console.log("\nNoting any disputes that may be an issue after the upgrade...");
    verifyEquals(await master.getUintVar(h.hash("_DISPUTE_COUNT")), expectedDisputeCount, "No new disputes")

    console.log("\nMANUALLY note if anything has been run on contracts before init");

    console.log("\n" + passCount + "/" + (passCount+failCount) + " checks passed");
}

function verifyEquals(firstVal, secondVal, name) {
  if(firstVal == secondVal) {
    console.log(name + " " + "passes");
    passCount++
  } else {
    console.log(name + " " + "fails. expected:" + secondVal + " actual:" + firstVal);
    failCount++
  }
}

function verifyGreaterThan(firstVal, secondVal, name) {
  if(firstVal > secondVal) {
    console.log(name + " " + "passes");
    passCount++
  } else {
    console.log(name + " " + "fails. expected greater than:" + secondVal + " actual:" + firstVal);
    failCount++
  }
}

function verifyGreaterThanOrEqualTo(firstVal, secondVal, name) {
  if(firstVal >= secondVal) {
    console.log(name + " " + "passes");
    passCount++
  } else {
    console.log(name + " " + "fails. expected greater than or equal to:" + secondVal + " actual:" + firstVal);
    failCount++
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

manualChecks("rinkeby", process.env.TESTNET_PK, process.env.TESTNET_PK2, process.env.NODE_URL_RINKEBY)
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
