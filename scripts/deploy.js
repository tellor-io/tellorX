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

async function deployTellorx( _network, _pk, _nodeURL) {

    console.log("deploy tellor X")
    await run("compile")


    var net = _network


    ///////////////Connect to the network
    let privateKey = _pk;
    var provider = new ethers.providers.JsonRpcProvider(_nodeURL) 
    let wallet = new ethers.Wallet(privateKey, provider);


    ////////////////Governance
    console.log("Starting deployment for governance contract...")
    const gfac = await ethers.getContractFactory("contracts/Governance.sol:Governance", wallet)
    const gfacwithsigner = await gfac.connect(wallet)
    const governance = await gfacwithsigner.deploy()
    console.log("Governance contract deployed to: ", governance.address)

    await governance.deployed()

    if (net == "mainnet"){ 
        console.log("Governance contract deployed to:", "https://etherscan.io/address/" + governance.address);
        console.log("   Governance transaction hash:", "https://etherscan.io/tx/" + governance.deployTransaction.hash);
    } else if (net == "rinkeby") {
        console.log("Governance contract deployed to:", "https://rinkeby.etherscan.io/address/" + governance.address);
        console.log("    Governance transaction hash:", "https://rinkeby.etherscan.io/tx/" + governance.deployTransaction.hash);
    } else {
        console.log("Please add network explorer details")
    }

    // Wait for few confirmed transactions.
    // Otherwise the etherscan api doesn't find the deployed contract.
    console.log('waiting for governance tx confirmation...');
    await governance.deployTransaction.wait(3)

    console.log('submitting governance contract for verification...');
    await run("verify:verify",
      {
      address: governance.address,
      },
    )
    console.log("governance contract verified")

    /////////////Oracle
    console.log("Starting deployment for Oracle contract...")
    const ofac = await ethers.getContractFactory("contracts/Oracle.sol:Oracle", wallet)
    const ofacwithsigner = await ofac.connect(wallet)
    const oracle = await ofacwithsigner.deploy()
    await oracle.deployed();


    if (net == "mainnet"){
        console.log("oracle contract deployed to:", "https://etherscan.io/address/" + oracle.address);
        console.log("    oracle transaction hash:", "https://etherscan.io/tx/" + oracle.deployTransaction.hash);
    } else if (net == "rinkeby") {
        console.log("oracle contract deployed to:", "https://rinkeby.etherscan.io/address/" + oracle.address);
        console.log("    oracle transaction hash:", "https://rinkeby.etherscan.io/tx/" + oracle.deployTransaction.hash);
    } else {
        console.log("Please add network explorer details")
    }

    // Wait for few confirmed transactions.
    // Otherwise the etherscan api doesn't find the deployed contract.
    console.log('waiting for Oracle tx confirmation...');
    await oracle.deployTransaction.wait(3)

    console.log('submitting Oracle contract for verification...');

    await run("verify:verify",
      {
      address: oracle.address,
      },
    )

    console.log("Oracle contract verified")

    ///////////Treasury
    console.log("Starting deployment for Treasury contract...")
    const tfac = await ethers.getContractFactory("contracts/Treasury.sol:Treasury", wallet)
    const tfacwithsigner = await tfac.connect(wallet)
    const treasury = await tfacwithsigner.deploy()
    await treasury.deployed()

    if (net == "mainnet"){
        console.log("treasury contract deployed to:", "https://etherscan.io/address/" + treasury.address);
        console.log("    treasury transaction hash:", "https://etherscan.io/tx/" + treasury.deployTransaction.hash);
    } else if (net == "rinkeby") {
        console.log("treasury contract deployed to:", "https://rinkeby.etherscan.io/address/" + treasury.address);
        console.log("    treasury transaction hash:", "https://rinkeby.etherscan.io/tx/" + treasury.deployTransaction.hash);
    } else {
        console.log("Please add network explorer details")
    }

    // Wait for few confirmed transactions.
    // Otherwise the etherscan api doesn't find the deployed contract.
    console.log('waiting for treasury tx confirmation...');
    await treasury.deployTransaction.wait(3)

    console.log('submitting Treasury contract for verification...');

    await run("verify:verify", {
      address: treasury.address,
    },
    )

    console.log("treasury Contract verified")

    //////////////Controler
    console.log("Starting deployment for Controller contract...")
    const cfac = await ethers.getContractFactory("contracts/Controller.sol:Controller", wallet)
    const cfacwithsigners = await cfac.connect(wallet)
    const controller = await cfacwithsigners.deploy()
    await controller.deployed()

    if (net == "mainnet"){
        console.log("The controller contract was deployed to:", "https://etherscan.io/address/" + controller.address);
        console.log("    transaction hash:", "https://etherscan.io/tx/" + controller.deployTransaction.hash);
    } else if (net == "rinkeby") {
        console.log("The controller contract was deployed to:", "https://rinkeby.etherscan.io/address/" + controller.address);
        console.log("    transaction hash:", "https://rinkeby.etherscan.io/tx/" + controller.deployTransaction.hash);
    } else {
        console.log("Please add network explorer details")
    }

    // Wait for few confirmed transactions.
    // Otherwise the etherscan api doesn't find the deployed contract.
    console.log('waiting for tx confirmation...');
    await controller.deployTransaction.wait(3)

    console.log('submitting contract for verification...');

    await run("verify:verify",
      {
      address: controller.address,
      },
    )

    console.log("Controller contract verified")
    console.log("Propose a fork to the Controller address and run the init function")


}


deployTellorx( "rinkeby", process.env.TESTNET_PK, process.env.NODE_URL_RINKEBY)
.then(() => process.exit(0))
.catch(error => {
  console.error(error);
  process.exit(1);
});