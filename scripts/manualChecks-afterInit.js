require("hardhat-gas-reporter");
require('hardhat-contract-sizer');
require("solidity-coverage");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("dotenv").config();
const web3 = require("web3");
const h = require("../test/helpers/helpers");

//npx hardhat run scripts/manualChecks-afterInit.js --network rinkeby

// Update these variables before running script
const masterAddress = "0x657b95c228A5de81cdc3F85be7954072c08A6042"
const controllerAddress = "0xEf2624001496ae4586C8a03fEAf9f130deB8fFEA"
const oracleAddress = "0x07b521108788C6fD79F471D603A2594576D47477"
const governanceAddress = "0x9Bc06e725d4b7820f587f4fC6bf9Dfa1f1983477"
const treasuryAddress = "0x6e73d0185B4Edf227D36007448b613d6Bf2EF1c3"
etherPrice = 4500000000
amplPrice = 1500000
disputeCount = 0

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
    // * After init()
    // *
    // *************************************
    console.log("\nAfter init checks:");
    // Pull old value
    console.log("\nPulling old value...");
    lastNewVal = await master.getLastNewValueById(1)
    verifyGreaterThan(lastNewVal[0], 0, "pull old value")

    // Add Tip to old ID's (AMPL, ETH/USD)
    console.log("\nAdding tip to old ID's (AMPL, ETH/USD)...");
    await oracle.connect(wallet).tipQuery(h.uintTob32(1), web3.utils.toWei("1"), "0x")
    await sleep(15000)
    verifyGreaterThanOrEqualTo(await oracle.getTipsById(h.uintTob32(1)), web3.utils.toWei("1"), "ETH/USD tips in contract")
    await oracle.connect(wallet).tipQuery(h.uintTob32(10), web3.utils.toWei("1"), "0x")
    await sleep(15000)
    verifyGreaterThanOrEqualTo(await oracle.getTipsById(h.uintTob32(10)), web3.utils.toWei("1"), "AMPL/USD tips in contract")

    // Mine AMPL/ ETH/USD
    console.log("\nMining AMPL/USD and ETH/USD...");

    await master.connect(wallet).transfer(wallet2.address, web3.utils.toWei("100"))
    await master.connect(wallet).depositStake()
    await sleep(15000)
    await master.connect(wallet2).depositStake()
    await sleep(15000)
    nonce = await oracle.getTimestampCountById(h.uintTob32(1))
    await oracle.connect(wallet).submitValue(h.uintTob32(1), etherPrice, nonce, "0x")
    nonce = await oracle.getTimestampCountById(h.uintTob32(10))
    await oracle.connect(wallet2).submitValue(h.uintTob32(10), amplPrice, nonce, "0x")
    await sleep(15000)

    // Read new values from old contract
    console.log("\nReading new values from old contract...");
    lastNewValEth = await master.getLastNewValueById(1)
    verifyEquals(lastNewValEth[0], etherPrice, "Mine & read ETH/USD")
    lastNewValAmpl = await master.getLastNewValueById(10)
    verifyEquals(lastNewValAmpl[0], amplPrice, "Mine & read AMPL/USD")

    // Ensure no disputes for next week on previous submissions (old stuff)
    console.log("\nEnsuring no disputes on previous submissions (old stuff)...");
    verifyEquals(await master.getUintVar("0x310199159a20c50879ffb440b45802138b5b162ec9426720e9dd3ee8bbcdb9d7"), disputeCount, "No disputes on old stuff")
    console.log("Keep checking for new disputes on old values for one week");

    // transfer
    console.log("\nTransferring TRB...");
    bal0 = await master.balanceOf(wallet2.address)
    await master.connect(wallet).transfer(wallet2.address, web3.utils.toWei("1"))
    await sleep(15000)
    bal1 = await master.balanceOf(wallet2.address)
    verifyEquals(bal1.sub(bal0), web3.utils.toWei("1"), "TRB transfer")

    // approve a token
    console.log("\nApproving a token...");
    await master.connect(wallet).approve(wallet2.address, web3.utils.toWei("10"))
    await sleep(15000)
    verifyEquals(await master.allowance(wallet.address, wallet2.address), web3.utils.toWei("10"), "token approval")
    await master.connect(wallet2).transferFrom(wallet.address, wallet2.address, web3.utils.toWei("10"))
    await sleep(15000)
    bal2 = await master.balanceOf(wallet2.address)
    verifyEquals(bal2.sub(bal1), web3.utils.toWei("10"), "TRB transfer")

    console.log(passCount + "/" + (passCount+failCount) + " checks passed");
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
