// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "./interfaces/IController.sol";
import "./TellorVars.sol";
import "./interfaces/IGovernance.sol";
import "hardhat/console.sol";

contract Treasury is TellorVars{
    uint256 public totalLocked;
    uint256 public treasuryCount;
    mapping(uint => TreasuryDetails) public treasury;
    mapping(address => uint256) treasuryFundsByUser;

    struct TreasuryUser{
        uint256 amount;
        uint256 startVoteCount;
        bool paid;
    }
    struct TreasuryDetails{
        uint256 dateStarted;
        uint256 totalAmount;
        uint256 rate;
        uint256 purchased;
        uint256 duration;
        uint256 endVoteCount;
        bool endVoteCountRecorded;
        address[] owners;
        mapping(address => TreasuryUser) accounts;
    }

    event TreasuryIssued(uint256 _id,uint256 _amount,uint256 _rate);
    event TreasuryPaid(address _investor, uint256 _amount);
    event TreasuryPurchased(address _investor,uint256 _amount);

    function buyTreasury(uint256 _id,uint256 _amount) external{
        //deposit money into a Treasury
        require(IController(TELLOR_ADDRESS).approveAndTransferFrom(msg.sender,address(this),_amount));
        treasuryFundsByUser[msg.sender]+=_amount;
        TreasuryDetails storage _treas = treasury[_id];
        require(_amount <= _treas.totalAmount - _treas.purchased);
        address governanceContract = IController(TELLOR_ADDRESS).addresses(_GOVERNANCE_CONTRACT);
        _treas.accounts[msg.sender].startVoteCount = IGovernance(governanceContract).getVoteCount();
        _treas.purchased += _amount;
        _treas.accounts[msg.sender].amount += _amount;      
        _treas.owners.push(msg.sender);
        totalLocked += _amount;
        emit TreasuryPurchased(msg.sender,_amount);
    }

    function delegateVotingPower(address _delegate) external{
        require(msg.sender == IController(TELLOR_ADDRESS).addresses(_GOVERNANCE_CONTRACT));
        IGovernance(msg.sender).delegate(_delegate);
    }

    //_amount of TRB, _rate in bp
    function issueTreasury(uint256 _totalAmount, uint256 _rate, uint256 _duration) external{
        require(msg.sender == IController(TELLOR_ADDRESS).addresses(_GOVERNANCE_CONTRACT));
        treasuryCount++;
        TreasuryDetails storage _treas = treasury[treasuryCount];
        _treas.dateStarted = block.timestamp;
        _treas.totalAmount = _totalAmount;
        _treas.rate = _rate;
        _treas.duration = _duration;
        emit TreasuryIssued(treasuryCount,_totalAmount,_rate);
    }

    function payTreasury(address _investor,uint256 _id) external{
        //calculate number of votes in governance contract when issued
        TreasuryDetails storage treas = treasury[_id];
        require(_id <= treasuryCount);
        require(treas.dateStarted + treas.duration <= block.timestamp);
        require(!treas.accounts[_investor].paid);
        //calculate non-voting penalty (treasury holders have to vote)
        uint256 numVotesParticipated;
        uint256 votesSinceTreasury;
        address governanceContract = IController(TELLOR_ADDRESS).addresses(_GOVERNANCE_CONTRACT);
        //Find endVoteCount if not already calculated
        if(!treas.endVoteCountRecorded) {
            uint256 voteCountIter = IGovernance(governanceContract).getVoteCount();
            if(voteCountIter > 0) {
                (,uint256[8] memory voteInfo,,,,,) = IGovernance(governanceContract).getVoteInfo(voteCountIter);
                while(voteCountIter > 0 && voteInfo[1] > treas.dateStarted + treas.duration) {
                    voteCountIter--;
                    if(voteCountIter > 0) {
                        (,voteInfo,,,,,) = IGovernance(governanceContract).getVoteInfo(voteCountIter);
                    }
                }
            }
            treas.endVoteCount = voteCountIter;
            treas.endVoteCountRecorded = true;
        }
        //Add up number of votes _investor has participated in
        if(treas.endVoteCount > treas.accounts[_investor].startVoteCount){
            for(
                uint256 voteCount = treas.accounts[_investor].startVoteCount;
                voteCount < treas.endVoteCount;
                voteCount++
            ) {
                bool voted = IGovernance(governanceContract).didVote(voteCount + 1, _investor);
                if (voted) {
                    numVotesParticipated++;
                }
                votesSinceTreasury++;
            }
        }
        uint256 _mintAmount = treas.accounts[_investor].amount * treas.rate/10000;
        if(votesSinceTreasury > 0){
            _mintAmount = _mintAmount *numVotesParticipated / votesSinceTreasury;
        }
        IController(TELLOR_ADDRESS).mint(address(this),_mintAmount);
        totalLocked -= treas.accounts[_investor].amount;
        IController(TELLOR_ADDRESS).transfer(_investor,_mintAmount + treas.accounts[_investor].amount);
        treasuryFundsByUser[_investor] -= treas.accounts[_investor].amount;
        treas.accounts[_investor].paid = true;
        emit TreasuryPaid(_investor,_mintAmount + treas.accounts[_investor].amount);
    }

    //Getters
    function getTreasuryAccount(uint256 _id, address _investor) external view returns(uint256, uint256, bool){
        return (
            treasury[_id].accounts[_investor].amount,
            treasury[_id].accounts[_investor].startVoteCount,
            treasury[_id].accounts[_investor].paid
        );
    }

    function getTreasuryDetails(uint256 _id) external view returns(uint256,uint256,uint256,uint256){
        return(treasury[_id].dateStarted,treasury[_id].totalAmount,treasury[_id].rate,treasury[_id].purchased);
    }

    function getTreasuryFundsByUser(address _user) external view returns(uint256){
        return treasuryFundsByUser[_user];
    }

    function getTreasuryOwners(uint256 _id) external view returns(address[] memory){
        return treasury[_id].owners;
    }

    function verify() external pure returns(uint){
        return 9999;
    }

    function wasPaid(uint256 _id, address _investor) external view returns(bool){
        return treasury[_id].accounts[_investor].paid;
    }
}
