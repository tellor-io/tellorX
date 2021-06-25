// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;
import "./Token.sol";
import "./interfaces/IGovernance.sol";

contract TellorStaking is Token{

    event NewStaker(address _staker);
    event StakeWithdrawRequested(address _staker);
    event StakeWithdrawn(address _staker);

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
        stakes.startDate = block.timestamp - (block.timestamp % 86400);
        uints[_STAKE_COUNT] -= 1;
        IGovernance(addresses[_GOVERNANCE_CONTRACT]).updateMinDisputeFee();
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

    function changeStakingStatus(address _reporter, uint _status) external{
        require(msg.sender == addresses[_GOVERNANCE_CONTRACT]);
        StakeInfo storage stakes = stakerDetails[_reporter];
        stakes.currentStatus = _status;
    }

    function slashMiner(address _reporter, address _disputer) external{
        require(msg.sender == addresses[_GOVERNANCE_CONTRACT]);
        _doTransfer(_reporter,_disputer, uints[_STAKE_AMOUNT]);
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