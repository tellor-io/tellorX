
/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require("@nomiclabs/hardhat-waffle");
require("hardhat-gas-reporter");
require("solidity-coverage");
require("hardhat-gas-reporter");
require('hardhat-contract-sizer');
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require("dotenv").config();

//Run this commands to deploy tellor playground:
//npx hardhat deploy --net rinkeby --network rinkeby
//npx hardhat deploy --net mainnet --network mainnet

//  task("deploy", "Deploy and verify the contracts")
//  .addParam("net", "network to deploy in")
//  .setAction(async taskArgs => {

//   var net = taskArgs.net
//   const tellorMaster = "0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0"
//   const DEV_WALLET = "0x39E419bA25196794B595B2a595Ea8E527ddC9856"
//   let gfac
//   let ofac
//   let tfac
//   let cfac

//   await run("compile");

//   tellorMasterInst = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor", tellorMaster)

//     console.log("Starting deployment for governance contract...")
//     gfac = await ethers.getContractFactory("contracts/testing/Governance.sol:Governance")
//     governance = await gfac.deploy()
//     await governance.deployed()

//     if (net == "mainnet"){
//         console.log("Governance contract deployed to:", "https://etherscan.io/address/" + governance.address);
//         console.log("   Governance transaction hash:", "https://etherscan.io/tx/" + governance.deployTransaction.hash);
//     } else if (net == "rinkeby") {
//         console.log("Governance contract deployed to:", "https://rinkeby.etherscan.io/address/" + governance.address);
//         console.log("    Governance transaction hash:", "https://rinkeby.etherscan.io/tx/" + governance.deployTransaction.hash);
//     } else {
//         console.log("Please add network explorer details")
//     }

//     // Wait for few confirmed transactions.
//     // Otherwise the etherscan api doesn't find the deployed contract.
//     console.log('waiting for governance tx confirmation...');
//     await governance.deployTransaction.wait(3)

//     console.log('submitting governance contract for verification...');
//     await run("verify:verify",
//       {
//       address: governance.address,
//       },
//     )
//     console.log("governance contract verified")

//     console.log("Starting deployment for Oracle contract...")
//     ofac = await ethers.getContractFactory("contracts/Oracle.sol:Oracle")
//     oracle = await ofac.deploy()
//     await oracle.deployed();


//     if (net == "mainnet"){
//         console.log("oracle contract deployed to:", "https://etherscan.io/address/" + oracle.address);
//         console.log("    oracle transaction hash:", "https://etherscan.io/tx/" + oracle.deployTransaction.hash);
//     } else if (net == "rinkeby") {
//         console.log("oracle contract deployed to:", "https://rinkeby.etherscan.io/address/" + oracle.address);
//         console.log("    oracle transaction hash:", "https://rinkeby.etherscan.io/tx/" + oracle.deployTransaction.hash);
//     } else {
//         console.log("Please add network explorer details")
//     }

//     // Wait for few confirmed transactions.
//     // Otherwise the etherscan api doesn't find the deployed contract.
//     console.log('waiting for Oracle tx confirmation...');
//     await oracle.deployTransaction.wait(3)

//     console.log('submitting Oracle contract for verification...');

//     await run("verify:verify",
//       {
//       address: oracle.address,
//       },
//     )

//     console.log("Oracle contract verified")

//     console.log("Starting deployment for Treasury contract...")
//     tfac = await ethers.getContractFactory("contracts/Treasury.sol:Treasury")
//     treasury = await tfac.deploy()
//     await treasury.deployed()

//     if (net == "mainnet"){
//         console.log("treasury contract deployed to:", "https://etherscan.io/address/" + treasury.address);
//         console.log("    treasury transaction hash:", "https://etherscan.io/tx/" + treasury.deployTransaction.hash);
//     } else if (net == "rinkeby") {
//         console.log("treasury contract deployed to:", "https://rinkeby.etherscan.io/address/" + treasury.address);
//         console.log("    treasury transaction hash:", "https://rinkeby.etherscan.io/tx/" + treasury.deployTransaction.hash);
//     } else {
//         console.log("Please add network explorer details")
//     }

//     // Wait for few confirmed transactions.
//     // Otherwise the etherscan api doesn't find the deployed contract.
//     console.log('waiting for treasury tx confirmation...');
//     await treasury.deployTransaction.wait(3)

//     console.log('submitting Treasury contract for verification...');

//     await run("verify:verify", {
//       address: treasury.address,
//     },
//     )

//     console.log("treasury Contract verified")

//     console.log("Starting deployment for Controller contract...")
//     cfac = await ethers.getContractFactory("contracts/testing/Controller.sol:Controller")
//     controller = await cfac.deploy()
//     await controller.deployed()

//     if (net == "mainnet"){
//         console.log("The controller contract was deployed to:", "https://etherscan.io/address/" + controller.address);
//         console.log("    transaction hash:", "https://etherscan.io/tx/" + controller.deployTransaction.hash);
//     } else if (net == "rinkeby") {
//         console.log("The controller contract was deployed to:", "https://rinkeby.etherscan.io/address/" + controller.address);
//         console.log("    transaction hash:", "https://rinkeby.etherscan.io/tx/" + controller.deployTransaction.hash);
//     } else {
//         console.log("Please add network explorer details")
//     }

//     // Wait for few confirmed transactions.
//     // Otherwise the etherscan api doesn't find the deployed contract.
//     console.log('waiting for tx confirmation...');
//     await controller.deployTransaction.wait(3)

//     console.log('submitting contract for verification...');

//     await run("verify:verify",
//       {
//       address: controller.address,
//       },
//     )

//     console.log("Controller contract verified")
//     console.log("Propose a fork to the Controller address and run the init function")


//  })

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.3",
        settings: {
          optimizer: {
            enabled: true,
            runs: 300
          }
        }
      },
      {
        version: "0.7.4",
        settings: {
          optimizer: {
            enabled: true,
            runs: 300
          }
        }
      }
    ]
  },
  networks: {
    hardhat: {
      hardfork: process.env.CODE_COVERAGE ? "berlin" : "london",
      initialBaseFeePerGas: 0,
      accounts: {
        mnemonic:
          "nick lucian brenda kevin sam fiscal patch fly damp ocean produce wish",
        count: 40,
      },
      forking: {
        url: "https://eth-mainnet.alchemyapi.io/v2/7dW8KCqWwKa1vdaitq-SxmKfxWZ4yPG6"
      },
      allowUnlimitedContractSize: true
    },
    rinkeby: {
      url: `${process.env.NODE_URL_RINKEBY}`,
      seeds: [process.env.PRIVATE_KEY],
      gas: 10000000,
      gasPrice: 1000000000
    },
    goerli: {
      url: `${process.env.NODE_URL_GOERLI}`,
      seeds: [process.env.PRIVATE_KEY],
      gas: 8000000,
      gasPrice: 10000000000
    },
    //,
    // mainnet: {
    //   url: `${process.env.NODE_URL_MAINNET}`,
    //   accounts: [process.env.PRIVATE_KEY],
    //   gas: 10000000 ,
    //   gasPrice: 50000000000
    // }
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: process.env.ETHERSCAN
  },

  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false,
  },

  mocha: {
    grep: "@skip-on-coverage", // Find everything with this tag
    invert: true               // Run the grep's inverse set.
  }




}
