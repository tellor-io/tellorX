//require("@nomiclabs/hardhat-truffle5");
require("hardhat-gas-reporter");
require('hardhat-contract-sizer');
require("solidity-coverage");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("dotenv").config();

//const dotenv = require('dotenv').config()
//npx hardhat run scripts/deploy.js --network rinkeby

async function manualChecks(_network, _pk, _nodeURL) {
    await run("compile")

    await run("compile")


    var net = _network


    ///////////////Connect to the network
    let privateKey = _pk;
    var provider = new ethers.providers.JsonRpcProvider(_nodeURL)
    let wallet = new ethers.Wallet(privateKey, provider)

    const masterAddress = "0x657b95c228A5de81cdc3F85be7954072c08A6042"
    const controllerAddress = "0xEf2624001496ae4586C8a03fEAf9f130deB8fFEA"
    const oracleAddress = "0x07b521108788C6fD79F471D603A2594576D47477"
    const governanceAddress = "0x9Bc06e725d4b7820f587f4fC6bf9Dfa1f1983477"
    const treasuryAddress = "0x6e73d0185B4Edf227D36007448b613d6Bf2EF1c3"

    master = await ethers.getContractAt("contracts/tellor3/ITellor.sol:ITellor", masterAddress)
    controller = await ethers.getContractAt("contracts/Controller.sol:Controller", controllerAddress)
    oracle = await ethers.getContractAt("contracts/Oracle.sol:Oracle", oracleAddress)
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance", governanceAddress)
    treasury = await ethers.getContractAt("contracts/Treasury.sol:Treasury", treasuryAddress)


    console.log("Before init checks:");
    console.log("Checking values of all storage variables...");




    // Before init()

    // Check values of all storage variables
    console.log("Checking controller contract storage...");
    verifyStorage(1,1,"testStorage")
    verifyStorage(await controller.addresses("0xefa19baa864049f50491093580c5433e97e8d5e41f8db1a61108b4fa44cacd93"), governance.address, "_GOVERNANCE_CONTRACT address")
    verifyStorage(await controller.addresses("0xfa522e460446113e8fd353d7fa015625a68bc0369712213a42e006346440891e"), oracle.address, "_ORACLE_CONTRACT address")
    verifyStorage(await controller.addresses("0x1436a1a60dca0ebb2be98547e57992a0fa082eb479e7576303cbd384e934f1fa"), treasury.address, "_TREASURY_CONTRACT address")

    console.log("Checking governance contract storage...");
    verifyStorage(await governance.isFunctionApproved("0x3c46a185"), true, "changeControllerContract(address) approval")
    verifyStorage(await governance.isFunctionApproved("0xe8ce51d7"), true, "changeGovernanceContract(address) approval")
    verifyStorage(await governance.isFunctionApproved("0x1cbd3151"), true, "changeOracleContract(address) approval")
    verifyStorage(await governance.isFunctionApproved("0xbd87e0c9"), true, "changeTreasuryContract(address) approval")
    verifyStorage(await governance.isFunctionApproved("0x740358e6"), true, "changeUint(bytes32,uint256) approval")
    verifyStorage(await governance.isFunctionApproved("0x40c10f19"), true, "mint(address,uint256) approval")
    verifyStorage(await governance.isFunctionApproved("0xe48d4b3b"), true, "setApprovedFunction(bytes4,bool) approval")
    verifyStorage(await governance.isFunctionApproved("0x5d183cfa"), true, "changeReportingLock(uint256) approval")
    verifyStorage(await governance.isFunctionApproved("0x6d53585f"), true, "changeTimeBasedReward(uint256) approval")
    verifyStorage(await governance.isFunctionApproved("0x6274885f"), true, "issueTreasury(uint256,uint256,uint256) approval")

    let voteCount = await governance.voteCount();
    console.log("voteCount: " + voteCount);
    verifyStorage(await governance.voteCount(), 0, "voteCount")
    verifyStorageGreaterThan(await governance.disputeFee(), 0, "disputeFee")


    // Note any disputes that may be an issue after the upgrade
    // Note if anything has been run on contracts before init




    ////////////// Deploy Tellor 3

    //////////////// Extension
    // console.log("Starting deployment for extension contract...")
    // const extfac = await ethers.getContractFactory("contracts/tellor3/Extension.sol:Extension", wallet)
    // const extfacwithsigner = await extfac.connect(wallet)
    // const extension = await extfac.deploy()
    // console.log("Extension contract deployed to: ", extension.address)
    //
    // await extension.deployed()
    //
    // if (net == "mainnet") {
    //     console.log("Extension contract deployed to:", "https://etherscan.io/address/" + extension.address);
    //     console.log("   Extension transaction hash:", "https://etherscan.io/tx/" + extension.deployTransaction.hash);
    // } else if (net == "rinkeby") {
    //     console.log("Extension contract deployed to:", "https://rinkeby.etherscan.io/address/" + extension.address);
    //     console.log("    Extension transaction hash:", "https://rinkeby.etherscan.io/tx/" + extension.deployTransaction.hash);
    // } else {
    //     console.log("Please add network explorer details")
    // }
    //
    //
    //
    //
    // //////////////// Tellor (Test)
    // console.log("Starting deployment for tellor contract...")
    // const telfac = await ethers.getContractFactory("contracts/tellor3/Mocks/TellorTest.sol:TellorTest", wallet)
    // const telfacwithsigner = await telfac.connect(wallet)
    // const tellor = await telfac.deploy(extension.address)
    // console.log("Tellor contract deployed to: ", tellor.address)
    //
    // await tellor.deployed()
    //
    // if (net == "mainnet") {
    //     console.log("Tellor contract deployed to:", "https://etherscan.io/address/" + tellor.address);
    //     console.log("   Tellor transaction hash:", "https://etherscan.io/tx/" + tellor.deployTransaction.hash);
    // } else if (net == "rinkeby") {
    //     console.log("Tellor contract deployed to:", "https://rinkeby.etherscan.io/address/" + tellor.address);
    //     console.log("    Tellor transaction hash:", "https://rinkeby.etherscan.io/tx/" + tellor.deployTransaction.hash);
    // } else {
    //     console.log("Please add network explorer details")
    // }
    //
    //
    // //////////////// Master
    // console.log("Starting deployment for master contract...")
    // const masfac = await ethers.getContractFactory("contracts/tellor3/TellorMaster.sol:TellorMaster", wallet)
    // const masfacwithsigner = await masfac.connect(wallet)
    // const master = await masfac.deploy(tellor.address, tellor.address) // use same addr for _OLD_TELLOR and _newTellor?
    // console.log("Master contract deployed to: ", master.address)
    //
    // await master.deployed()
    //
    // if (net == "mainnet") {
    //     console.log("Master contract deployed to:", "https://etherscan.io/address/" + master.address);
    //     console.log("   Master transaction hash:", "https://etherscan.io/tx/" + master.deployTransaction.hash);
    // } else if (net == "rinkeby") {
    //     console.log("Master contract deployed to:", "https://rinkeby.etherscan.io/address/" + master.address);
    //     console.log("    Master transaction hash:", "https://rinkeby.etherscan.io/tx/" + master.deployTransaction.hash);
    // } else {
    //     console.log("Please add network explorer details")
    // }
    //
    //
    // /////////// Deploy Tellor X
    // console.log("deploy tellor X")
    //
    // ////////////////Governance
    // console.log("Starting deployment for governance contract...")
    // const gfac = await ethers.getContractFactory("contracts/Governance.sol:Governance", wallet)
    // const gfacwithsigner = await gfac.connect(wallet)
    // const governance = await gfacwithsigner.deploy()
    // console.log("Governance contract deployed to: ", governance.address)
    //
    // await governance.deployed()
    //
    // if (net == "mainnet") {
    //     console.log("Governance contract deployed to:", "https://etherscan.io/address/" + governance.address);
    //     console.log("   Governance transaction hash:", "https://etherscan.io/tx/" + governance.deployTransaction.hash);
    // } else if (net == "rinkeby") {
    //     console.log("Governance contract deployed to:", "https://rinkeby.etherscan.io/address/" + governance.address);
    //     console.log("    Governance transaction hash:", "https://rinkeby.etherscan.io/tx/" + governance.deployTransaction.hash);
    // } else {
    //     console.log("Please add network explorer details")
    // }
    //
    //
    // /////////////Oracle
    // console.log("Starting deployment for Oracle contract...")
    // const ofac = await ethers.getContractFactory("contracts/Oracle.sol:Oracle", wallet)
    // const ofacwithsigner = await ofac.connect(wallet)
    // const oracle = await ofacwithsigner.deploy()
    // await oracle.deployed();
    //
    //
    // if (net == "mainnet") {
    //     console.log("oracle contract deployed to:", "https://etherscan.io/address/" + oracle.address);
    //     console.log("    oracle transaction hash:", "https://etherscan.io/tx/" + oracle.deployTransaction.hash);
    // } else if (net == "rinkeby") {
    //     console.log("oracle contract deployed to:", "https://rinkeby.etherscan.io/address/" + oracle.address);
    //     console.log("    oracle transaction hash:", "https://rinkeby.etherscan.io/tx/" + oracle.deployTransaction.hash);
    // } else {
    //     console.log("Please add network explorer details")
    // }
    //
    // ///////////Treasury
    // console.log("Starting deployment for Treasury contract...")
    // const tfac = await ethers.getContractFactory("contracts/Treasury.sol:Treasury", wallet)
    // const tfacwithsigner = await tfac.connect(wallet)
    // const treasury = await tfacwithsigner.deploy()
    // await treasury.deployed()
    //
    // if (net == "mainnet") {
    //     console.log("treasury contract deployed to:", "https://etherscan.io/address/" + treasury.address);
    //     console.log("    treasury transaction hash:", "https://etherscan.io/tx/" + treasury.deployTransaction.hash);
    // } else if (net == "rinkeby") {
    //     console.log("treasury contract deployed to:", "https://rinkeby.etherscan.io/address/" + treasury.address);
    //     console.log("    treasury transaction hash:", "https://rinkeby.etherscan.io/tx/" + treasury.deployTransaction.hash);
    // } else {
    //     console.log("Please add network explorer details")
    // }
    //
    // console.log("treasury Contract verified")
    //
    // //////////////Controler
    // console.log("Starting deployment for Controller contract...")
    // const cfac = await ethers.getContractFactory("contracts/Controller.sol:Controller", wallet)
    // const cfacwithsigners = await cfac.connect(wallet)
    // const controller = await cfacwithsigners.deploy(governance.address, oracle.address, treasury.address)
    // await controller.deployed()
    //
    // if (net == "mainnet") {
    //     console.log("The controller contract was deployed to:", "https://etherscan.io/address/" + controller.address);
    //     console.log("    transaction hash:", "https://etherscan.io/tx/" + controller.deployTransaction.hash);
    // } else if (net == "rinkeby") {
    //     console.log("The controller contract was deployed to:", "https://rinkeby.etherscan.io/address/" + controller.address);
    //     console.log("    transaction hash:", "https://rinkeby.etherscan.io/tx/" + controller.deployTransaction.hash);
    // } else {
    //     console.log("Please add network explorer details")
    // }
    //
    // tellorTest = await ethers.getContractAt("contracts/tellor3/Mocks/TellorTest.sol:TellorTest", master.address)
    // await tellorTest.connect(wallet).setBalanceTest(wallet.address, ethers.BigNumber.from("1000000000000000000000000"))
    // await master.connect(wallet).changeTellorContract(controller.address)
    // tellorNew = await ethers.getContractAt("contracts/Controller.sol:Controller", master.address)
    // await tellorNew.connect(wallet).init()
    //
    // console.log("TellorX deployed! You have 1 million test TRB in your wallet.")
    //
    // console.log('submitting extension contract for verification...');
    // await run("verify:verify",
    //     {
    //         address: extension.address,
    //     },
    // )
    // console.log("extension contract verified")
    //
    // // Wait for few confirmed transactions.
    // // Otherwise the etherscan api doesn't find the deployed contract.
    // console.log('waiting for tx confirmation...');
    // await controller.deployTransaction.wait(7)
    //
    // console.log('submitting contract for verification...');
    //
    // await run("verify:verify",
    //     {
    //         address: controller.address,
    //         constructorArguments: [governance.address, oracle.address, treasury.address]
    //     },
    // )
    // console.log("Controller contract verified")
    //
    //
    // // Wait for few confirmed transactions.
    // // Otherwise the etherscan api doesn't find the deployed contract.
    // console.log('waiting for tellor tx confirmation...');
    // await tellor.deployTransaction.wait(7)
    //
    // console.log('submitting tellor contract for verification...');
    // await run("verify:verify",
    //     {
    //         address: tellor.address,
    //         constructorArguments: [extension.address]
    //     },
    // )
    // console.log("tellor contract verified")
    //
    // // Wait for few confirmed transactions.
    // // Otherwise the etherscan api doesn't find the deployed contract.
    // console.log('waiting for master tx confirmation...');
    // await master.deployTransaction.wait(7)
    //
    // console.log('submitting master contract for verification...');
    // await run("verify:verify",
    //     {
    //         address: master.address,
    //         constructorArguments: [tellor.address, tellor.address]
    //     },
    // )
    // console.log("master contract verified")
    //
    // // Wait for few confirmed transactions.
    // // Otherwise the etherscan api doesn't find the deployed contract.
    // console.log('waiting for governance tx confirmation...');
    // await governance.deployTransaction.wait(7)
    //
    // console.log('submitting governance contract for verification...');
    // await run("verify:verify",
    //     {
    //         address: governance.address,
    //     },
    // )
    // console.log("governance contract verified")
    //
    // // Wait for few confirmed transactions.
    // // Otherwise the etherscan api doesn't find the deployed contract.
    // console.log('waiting for treasury tx confirmation...');
    // await treasury.deployTransaction.wait(7)
    //
    // console.log('submitting Treasury contract for verification...');
    //
    // await run("verify:verify", {
    //     address: treasury.address,
    // },
    // )
    //
    // // Wait for few confirmed transactions.
    // // Otherwise the etherscan api doesn't find the deployed contract.
    // console.log('waiting for Oracle tx confirmation...');
    // await oracle.deployTransaction.wait(7)
    //
    // console.log('submitting Oracle contract for verification...');
    //
    // await run("verify:verify",
    //     {
    //         address: oracle.address,
    //     },
    // )
    //
    // console.log("Oracle contract verified")

}

function verifyStorage(firstVal, secondVal, name) {
  if(firstVal == secondVal) {
    console.log(name + " " + "passes");
  } else {
    console.log(name + " " + "fails");
  }
}

function verifyStorageGreaterThan(firstVal, secondVal, name) {
  if(firstVal > secondVal) {
    console.log(name + " " + "passes");
  } else {
    console.log(name + " " + "fails");
  }
}


manualChecks("rinkeby", process.env.TESTNET_PK, process.env.NODE_URL_RINKEBY)
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
