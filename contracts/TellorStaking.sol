// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;
import "./Token.sol";
import "./interfaces/IGovernance.sol";
import "hardhat/console.sol";

contract TellorStaking is Token{

    event NewStaker(address _staker);
    event StakeWithdrawRequested(address _staker);
    event StakeWithdrawn(address _staker);

    function changeStakingStatus(address _reporter, uint _status) external{
        require(msg.sender == addresses[_GOVERNANCE_CONTRACT]);
        StakeInfo storage stakes = stakerDetails[_reporter];
        stakes.currentStatus = _status;
    }

    function depositStake() external{
        require(
            balances[msg.sender][balances[msg.sender].length - 1].value >=
            uints[_STAKE_AMOUNT],
            "Balance is lower than stake amount"
        );
        //Ensure staker is not currently staked or is locked for withdraw
        require(
            stakerDetails[msg.sender].currentStatus == 0 ||
            stakerDetails[msg.sender].currentStatus == 2,
            "Miner is in the wrong state"
        );
        uints[_STAKE_COUNT] += 1;
        stakerDetails[msg.sender] = StakeInfo({
            currentStatus: 1, 
            startDate: block.timestamp//this resets their stake start date to now
        });
        emit NewStaker(msg.sender);
        IGovernance(addresses[_GOVERNANCE_CONTRACT]).updateMinDisputeFee();
    }

    function requestStakingWithdraw() external {
        StakeInfo storage stakes = stakerDetails[msg.sender];
        require(stakes.currentStatus == 1, "Miner is not staked");
        stakes.currentStatus = 2;
        stakes.startDate = block.timestamp;
        uints[_STAKE_COUNT] -= 1;
        IGovernance(addresses[_GOVERNANCE_CONTRACT]).updateMinDisputeFee();
        emit StakeWithdrawRequested(msg.sender);
    }

    function slashMiner(address _reporter, address _disputer) external{

        //require that only the governance contract can call it
        require(msg.sender == addresses[_GOVERNANCE_CONTRACT]);

        stakerDetails[_reporter].currentStatus = 5;


        if(balanceOf(_reporter) >= uints[_STAKE_AMOUNT]){
            _doTransfer(_reporter,_disputer,uints[_STAKE_AMOUNT]);
        }
        //in case we increase stake amount over their balance
        else if(balanceOf(_reporter) > 0){
            _doTransfer(_reporter,_disputer,balanceOf(_reporter));
        }
    }

    function withdrawStake() external {
        StakeInfo storage _s = stakerDetails[msg.sender];
        require(block.timestamp - _s.startDate >=  7 days,"7 days didn't pass");
        require(_s.currentStatus == 2,"Reporter not locked for withdrawal");
        _s.currentStatus = 0;
        emit StakeWithdrawn(msg.sender);
    }
    
    /**
     * @dev This function allows users to retrieve all information about a staker
     * @param _staker address of staker inquiring about
     * @return uint current state of staker
     * @return uint startDate of staking
     */
    function getStakerInfo(address _staker) external view returns (uint256, uint256){
        return (
            stakerDetails[_staker].currentStatus,
            stakerDetails[_staker].startDate
        );
    }
}
