// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "./interfaces/IController.sol";
import "./TellorVars.sol";
import "./interfaces/IGovernance.sol";

contract Treasury is TellorVars{
    uint256 public totalLocked;
    uint256 public treasuryCount;
    mapping(uint => TreasuryDetails) public treasury;
    mapping(address => uint256) treasuryFundsByUser;
    struct TreasuryDetails{
        uint256 dateStarted;
        uint256 amount;
        uint256 rate;
        uint256 purchased;
        uint256 duration;
        address[] owners;
        mapping(address => uint256) accounts;
        mapping(address => bool) paid;
    }

    event TreasuryIssued(uint256 _id,uint256 _amount,uint256 _rate);
    event TreasuryPaid(address _investor, uint256 _amount);
    event TreasuryPurchased(address _investor,uint256 _amount);

    function buyTreasury(uint256 _id,uint256 _amount) external{
        //deposit money into a Treasury
        require(IController(TELLOR_ADDRESS).approveAndTransferFrom(msg.sender,address(this),_amount));
        treasuryFundsByUser[msg.sender]+=_amount;
        TreasuryDetails storage _treas = treasury[_id];
        require(_amount <= _treas.amount - _treas.purchased);
        _treas.purchased += _amount;
        _treas.accounts[msg.sender] += _amount;      
        _treas.owners.push(msg.sender);
        emit TreasuryPurchased(msg.sender,_amount);
    }
    
    function delegateVotingPower(address _delegate) external{
        require(msg.sender == IController(TELLOR_ADDRESS).addresses(_GOVERNANCE_CONTRACT));
        IGovernance(msg.sender).delegate(_delegate);
    }
    
    //_amount of TRB, _rate in bp
    function issueTreasury(uint256 _amount, uint256 _rate, uint256 _duration) external{
        require(msg.sender == IController(TELLOR_ADDRESS).addresses(_GOVERNANCE_CONTRACT));
        //make sure the treasury contract has funds to pay
        require(IController(TELLOR_ADDRESS).balanceOf(address(this)) - totalLocked > _amount);
        totalLocked += _amount;
        treasuryCount++;
        TreasuryDetails storage _treas = treasury[treasuryCount];
        _treas.dateStarted = block.timestamp;
        _treas.amount = _amount;
        _treas.rate = _rate;
        _treas.duration = _duration;
        emit TreasuryIssued(treasuryCount,_amount,_rate);
    }

    function payTreasury(address _investor,uint256 _id) external{
        //calculate number of votes in governance contract when issue
        TreasuryDetails storage treas = treasury[_id];
        require(_id < treasuryCount);
        require(treas.dateStarted + treas.duration <= block.timestamp);
        require(!treas.paid[_investor]);
        uint256 _mintAmount = treas.accounts[_investor] * treas.rate;
        IController(TELLOR_ADDRESS).mint(address(this),_mintAmount);
        IController(TELLOR_ADDRESS).transfer(_investor,_mintAmount + treas.accounts[_investor]);
        treasuryFundsByUser[_investor]+= treas.accounts[_investor];
        treas.paid[_investor] = true;
        emit TreasuryPaid(_investor,_mintAmount + treas.accounts[_investor]);
    }

    //Getters
    function getTreasuryAccount(uint256 _id, address _investor) external view returns(uint256){
        return (treasury[_id].accounts[_investor]);
    }
    
    function getTreasuryDetails(uint256 _id) external view returns(uint256,uint256,uint256,uint256){
        return(treasury[_id].dateStarted,treasury[_id].amount,treasury[_id].rate,treasury[_id].purchased);
    }

    function getTreasuryOwners(uint256 _id) external view returns(address[] memory){
        return treasury[_id].owners;
    }

    function verify() external pure returns(uint){
        return 9999;
    }
    
    function wasPaid(uint256 _id, address _investor) external view returns(bool){
        return treasury[_id].paid[_investor];
    }
}