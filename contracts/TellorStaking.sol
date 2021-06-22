// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;


contract TellorStaking is TellorStorage, TellorVariables{

    function depositStake() external{
        require(
                balances[_staker][balances[_staker].length - 1].value >=
                    uints[_STAKE_AMOUNT],
                "Balance is lower than stake amount"
            );
            //Ensure staker is not currently staked or is locked for withdraw
            require(
                stakerDetails[_staker].currentStatus == 0 ||
                    stakerDetails[_staker].currentStatus == 2,
                "Miner is in the wrong state"
            );
            uints[_STAKE_COUNT] += 1;
            stakerDetails[_staker] = StakeInfo({
                currentStatus: 1, 
                startDate: block.timestamp//this resets their stake start date to now
            });
            emit NewStake(_staker);
        }
        ITellor(addresses[GOVERNANCE_CONTRACT]).updateMinDisputeFee();
    }

    function requestStakingWithdraw() external {
        StakeInfo storage stakes = stakerDetails[msg.sender];
        require(stakes.currentStatus == 1, "Miner is not staked");
        stakes.currentStatus = 2;
        stakes.startDate = block.timestamp - (block.timestamp % 86400);
        uints[_STAKE_COUNT] -= 1;
        ITellor(addresses[GOVERNANCE_CONTRACT]).updateMinDisputeFee();
        emit StakeWithdrawRequested(msg.sender);
    }

    function withdrawStake() external {
        StakeInfo storage stakes = stakerDetails[msg.sender];
        //Require staker is locked for withdraw(currentStatus ==2) and 7 days has passed
        require(
            block.timestamp - (block.timestamp % 86400) - stakes.startDate >=
                7 days,
            "7 days didn't pass"
        );
        require(
            stakes.currentStatus == 2,
            "Miner was not locked for withdrawal"
        );
        stakes.currentStatus = 0;
        emit StakeWithdrawn(msg.sender);
    }

    function changeStakingStatus(address _reporter, uint _status) external public{
        require(msg.sender == GOVERNANCE_CONTRACT);
        StakeInfo storage stakes = stakerDetails[_reporter];
        stakes.currentStatus = _status;
    }

    function slashMiner(address _reporter, address _disputer) external public{
        require(msg.sender == GOVERNANCE_CONTRACT);
        doTransfer(_reporter,_disputer, uints[STAKE_AMOUNT]);
        StakeInfo storage stakes = stakerDetails[_reporter];
        stakes.currentStatus = 5;
    }

        /**
     * @dev This function allows users to retrieve all information about a staker
     * @param _staker address of staker inquiring about
     * @return uint current state of staker
     * @return uint startDate of staking
     */
    function getStakerInfo(address _staker)
        external
        view
        returns (uint256, uint256)
    {
        return (
            stakerDetails[_staker].currentStatus,
            stakerDetails[_staker].startDate
        );
    }
}