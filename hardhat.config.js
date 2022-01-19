
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
    } //,
    // rinkeby: {
    //      url: `${process.env.NODE_URL_RINKEBY}`,
    //      seeds: [process.env.PRIVATE_KEY],
    //      gas: 10000000 ,
    //      gasPrice: 40000000000
    // } ,
      // mainnet: {
      //   url: `${process.env.NODE_URL_MAINNET}`,
      //   seeds: [process.env.PRIMARY_KEY],
      //   gas: 500000 ,
      //   gasPrice: 150000000000
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
