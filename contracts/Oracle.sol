// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "./interfaces/IController.sol";
import "./TellorVars.sol";

contract Oracle is TellorVars{

    uint256[] public timestamps;
    mapping(bytes32 => uint256) public tips;
    uint256 public tipsInContract;
    uint256 public timeOfLastNewValue = block.timestamp;
    uint256 public miningLock = 12 hours;//make this changeable by governance?
    uint256 public timeBasedReward = 5e17;
    mapping(bytes32 => Report) reports; //ID to reports
    mapping(address => uint256) reporterLastTimestamp;
    mapping(address => uint256) reportsSubmittedByAddress;
    mapping(address => uint256) tipsByUser;//mapping of a user to the amount of tips they've paid

    struct Report {
        uint256[] timestamps; //array of all newValueTimestamps requested
        mapping(uint256 => uint256) timestampIndex;
        mapping(uint256 => uint256) timestampToBlockNum; //[apiId][minedTimestamp]=>block.number
        mapping(uint256 => bytes) valueByTimestamp;
        mapping(uint256 => address) reporterByTimestamp;
    }

    event TipAdded(address _user, bytes32 _id,uint256 _tip, uint256 _totalTip);
    event NewReport(bytes32 _id, uint256 _time, bytes _value, uint256 _reward);
    event MiningLockChanged(uint _newMiningLock);
    event TimeBasedRewardsChanged(uint _newTimeBasedReward);

    function addTip(bytes32 _id, uint256 _tip) external{
        require(_tip > 1, "Tip should be greater than 1");
        require(IController(TELLOR_ADDRESS).approveAndTransferFrom(msg.sender,address(this),_tip), "tip must be paid");
        _tip = _tip/2;
        IController(TELLOR_ADDRESS).burn(_tip);
        tips[_id] += _tip;
        tipsByUser[msg.sender] += _tip;
        tipsInContract += _tip;
        emit TipAdded(msg.sender, _id, _tip, tips[_id]);
    }

    function changeMiningLock(uint256 _newMiningLock) external{
        require(msg.sender == IController(TELLOR_ADDRESS).addresses(_GOVERNANCE_CONTRACT));
        miningLock = _newMiningLock;
        emit MiningLockChanged(_newMiningLock);
    }

    function changeTimeBasedReward(uint256 _newTimeBasedReward) external{
        require(msg.sender == IController(TELLOR_ADDRESS).addresses(_GOVERNANCE_CONTRACT));
        timeBasedReward = _newTimeBasedReward;
        emit TimeBasedRewardsChanged(_newTimeBasedReward);
    }

    function removeValue(bytes32 _id, uint256 _timestamp) external {
        require(msg.sender == IController(TELLOR_ADDRESS).addresses(_GOVERNANCE_CONTRACT), "caller must be the governance contract");
        Report storage rep = reports[_id];
        uint256 _index = rep.timestampIndex[_timestamp];
        for (uint256 i = _index; i < rep.timestamps.length-1; i++){
            rep.timestamps[i] = rep.timestamps[i+1];
        }
        delete rep.timestamps[rep.timestamps.length-1];
        rep.timestamps.pop();
        rep.valueByTimestamp[_timestamp] = "";
    }

    function submitValue(bytes32 _id, bytes calldata _value) external{
        require(
            block.timestamp - reporterLastTimestamp[msg.sender]  > miningLock,
            "still in reporter time lock, please wait!"
        );
        reporterLastTimestamp[msg.sender] = block.timestamp;
        IController _tellor = IController(TELLOR_ADDRESS);
        (uint256 _status,) = _tellor.getStakerInfo(msg.sender);
        require(_status == 1,"Reporter status is not staker");
        //this check is in case the stake amount increases
        require(_tellor.balanceOf(msg.sender) >= _tellor.uints(_STAKE_AMOUNT), "balance must be greater than stake amount");
        Report storage rep = reports[_id];
        require(rep.reporterByTimestamp[block.timestamp] == address(0), "timestamp already reported for");
        rep.timestampIndex[block.timestamp] = rep.timestamps.length;
        rep.timestamps.push(block.timestamp);
        rep.timestampToBlockNum[block.timestamp] = block.number;
        rep.valueByTimestamp[block.timestamp] = _value;
        rep.reporterByTimestamp[block.timestamp] = msg.sender;
        //send tips + timeBasedReward
        uint256 _timeDiff = block.timestamp - timeOfLastNewValue;
        uint256 _tip = tips[_id];
        uint256 _reward = (_timeDiff * timeBasedReward) / 300;//.5 TRB per 5 minutes (should we make this upgradeable)
        if(_tellor.balanceOf(address(this)) < _reward + tipsInContract){
            _reward = _tellor.balanceOf(address(this)) - tipsInContract;
        }
        tipsInContract -= _tip;
        if(_reward + _tip > 0){
            _tellor.transfer(msg.sender,_reward + _tip);
        }
        tips[_id] = 0;
        timeOfLastNewValue = block.timestamp;
        reportsSubmittedByAddress[msg.sender]++;
        emit NewReport(_id, block.timestamp, _value,_tip + _reward);
    }

    function verify() external pure returns(uint){
        return 9999;
    }

    //Getters
    function getBlockNumberByTimestamp(bytes32 _id, uint256 _timestamp) external view returns(uint256){
        return reports[_id].timestampToBlockNum[_timestamp];
    }

    function getMiningLock() external view returns(uint256){
        return miningLock;
    }
    
    function getReporterByTimestamp(bytes32 _id, uint256 _timestamp) external view returns(address){
        return reports[_id].reporterByTimestamp[_timestamp];
    }

    function getReportsSubmittedByAddress(address _reporter) external view returns(uint256){
        return reportsSubmittedByAddress[_reporter];
    }

    function getTimestampCountById(bytes32 _id) external view returns(uint256){
        return reports[_id].timestamps.length;
    }   

    function getReportTimestampByIndex(bytes32 _id, uint256 _index) external view returns(uint256){
        return reports[_id].timestamps[_index];
    }

    function getTimeBasedReward() external view returns(uint256){
        return timeBasedReward;
    }

    function getTimeOfLastNewValue() external view returns(uint256){
        return timeOfLastNewValue;
    }
    function getTimestampIndexByTimestamp(bytes32 _id, uint256 _timestamp) external view returns(uint256){
        return reports[_id].timestampIndex[_timestamp];
    }

    function getTipsById(bytes32 _id) external view returns(uint256){
        return tips[_id];
    }

    function getTipsByUser(address _user) external view returns(uint256){
        return tipsByUser[_user];
    }

    function getValueByTimestamp(bytes32 _id, uint256 _timestamp) external view returns(bytes memory){
        return reports[_id].valueByTimestamp[_timestamp];
    }

    function getCurrentValue(bytes32 _id) external view returns(bytes memory){
         return reports[_id].valueByTimestamp[reports[_id].timestamps[reports[_id].timestamps.length-1]];
    }
}