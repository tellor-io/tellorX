// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;


contract Treasury{
    constant TELLOR_MASTER = ITellor("0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0");

    uint256 public totalLocked;
    uint256 public treasuryCount;
    mapping(uint => TreasuryDetails) public treasury;

    struct TreasuryDetails{
        uint256 dateStarted;
        uint256 amount;
        uint256 rate;
        uint256 purchased;
        []address owners;
        mapping(address => uint256) accounts;
        mapping(address => bool) paid;
    }

    event TreasuryIssued(uint256 _id,uint256 _amount,uint256 _rate);
    event TreasuryPaid(address _investor, uint256 _amount)
    event TreasuryPurchased(address _investor,uint256 _amount);

    //_amount of TRB, _rate in bp
    function issueTreasury(uint256 _amount, uint256 _rate, uint256 _duration) {
        require(msg.sender == TELLOR_MASTER.addresses[GOVERNANCE_CONTRACT]);
        require(TELLOR_MASTER.balanceOf(address(this) - totalLocked > _amount));
        totalLocked += _amount;
        treasuryCount++;
        treasury[treasuryCount] = TreasuryDetails{
            dateStared: block.timestamp,
            amount: _amount,
            rate: _rate,
            duration: _duration
        }
        emit TreasuryIssued(treasuryCount,_amount,_rate);
    }

    function payTreasury(address _investor,uint256 _id){
        //calculate number of votes in governance contract when issue
        TreasuryDetails storage treas = treasury[_id];
        require(_id < treasuryCount);
        require(treas.dateStarted + treas.duration <= block.timestamp);
        require(!treas.paid[_investor]);
        uint256 _mintAmount = treas.accounts[investor] * treas.rate;
        TELLORMASTER.mint(address(this),_mintAmount));
        transfer(investor,_mintAmount + treas.accounts[investor]);
        treas.paid[_investor] = true;
        emit TreasuryPaid(_investor,_mintAmount + treas.accounts[investor]);
    }

    function buyTreasury(uint256 _id,uint256 _amount, address _delegate) external{
        //deposit money into a Treasury
        require(TELLOR_MASTER.transferFrom(msg.sender,address(this),_amount));
        TreasuryDetails storage treas = treasury[_id];
        require(_amount <= treas.amount - treas.purchased);
        treas.purchased += _amount;
        treas.accounts[msg.sender] += _amount;      
        owners.push(msg.sender);
        emit TreasuryPurchased()
    }

    function getTreasuryDetails(uint256 _id) external view returns(uint256,uint256,uint256,uint256){
        TreasuryDetails memory treas = treasury[_id];
        return(treas.dateStarted,treas.amount,treas.rate,treas.purchased);
    }
    
    function getTreasuryAccount(uint256 _id, address _investor) external view returns(uint256){
        return (treasury[_id].accounts[_investor]);
    }

    function getTreasuryOwners(uint256 _id) external view returns(address[]){
        return treasury[_id].owners;
    }

    function wasPaid(uint256 _id, address _investor) external view returns(bool){
        return treasury[_id].paid[_investor];
    }

    function verify() public returns(uint){
        return 9999;
    }
}