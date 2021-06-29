// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "./interfaces/IController.sol";
import "./TellorVars.sol";

contract Oracle is TellorVars{

    uint256[] public timestamps;
    uint256 public maxID;
    mapping(uint256 => uint256) public tips;
    uint256 public timeOfLastNewValue;
    uint256 public burned;
    uint256 public toBurn;
    uint256 public miningLock = 12 hours;//make this changeable by governance?
    mapping(uint256 => Report) reports; //ID to reports
    mapping(uint256 => uint256[]) timestampToIDs; //mapping of timestamp to IDs pushed
    mapping(address => uint256) reporterLastTimestamp;
    mapping(address => uint256) reportsSubmittedByAddress;
    mapping(address => uint256) tipsByUser;//mapping of a user to the amount of tips they've paid

    struct Report {
        bytes details;
        uint256[] timestamps; //array of all newValueTimestamps requested
        mapping(uint256 => uint256) timestampIndex;
        mapping(uint256 => uint256) timestampToBlockNum; //[apiId][minedTimestamp]=>block.number
        mapping(uint256 => bytes) valueByTimestamp;
        mapping(uint256 => address) reporterByTimestamp;
    }

    event TipAdded(address _user, uint256 _id,uint256 _tip, uint256 _totalTip);
    event NewReport(uint256 _id, uint256 _time, bytes _value, uint256 _reward);
    event NewIdAdded(uint256 _id, bytes _details);

    function addTip(uint256 _id, uint256 _tip) external{
        require(_id != 0, "RequestId is 0");
        require(_tip != 0, "Tip should be greater than 0");
        require(_id <= maxID, "ID is out of range");
        require(IController(TELLOR_ADDRESS).approveAndTransferFrom(msg.sender,address(this),_tip));
        tips[_id] += _tip;
        tipsByUser[msg.sender] += _tip;
        emit TipAdded(msg.sender, _id, _tip, tips[_id]);
    }

    function addNewId(bytes calldata _details) external{
        require(msg.sender == IController(TELLOR_ADDRESS).addresses(_GOVERNANCE_CONTRACT));
        maxID++;
        reports[maxID].details = _details;
        emit NewIdAdded(maxID,_details);
    }

    function submitValue(uint256 _id, bytes calldata _value) external{
        require(
            block.timestamp - reporterLastTimestamp[msg.sender]  > miningLock,
            "Miner can only win rewards once per 12 hours"
        );
        reporterLastTimestamp[msg.sender] == block.timestamp;
        IController _tellor = IController(TELLOR_ADDRESS);
        (uint256 _status,) = _tellor.getStakerInfo(msg.sender);
        require(_status == 1,"Miner status is not staker");
        Report storage rep = reports[_id];
        require(rep.reporterByTimestamp[block.timestamp] == address(0), "timestamp already reported for");
        rep.timestampIndex[block.timestamp] = rep.timestamps.length;
        rep.timestamps.push(block.timestamp);
        rep.timestampToBlockNum[block.timestamp] = block.number;
        rep.valueByTimestamp[block.timestamp] = _value;
        rep.reporterByTimestamp[block.timestamp] = msg.sender;
        //send tips + timeBasedReward
        uint256 _timeDiff = block.timestamp - timeOfLastNewValue;
        uint256 _reward = (_timeDiff * 5e17) / 300;//.5 TRB per 5 minutes (should we make this upgradeable)
        if(_tellor.balanceOf(address(this)) < _reward){
            _reward = _tellor.balanceOf(address(this));
        }
        uint256 _tip = tips[_id] / 2;
        toBurn += _tip;
        _tellor.transfer(msg.sender,_reward + _tip);
        tips[_id] = 0;
        timeOfLastNewValue = block.timestamp;
        reportsSubmittedByAddress[msg.sender]++;
        emit NewReport(_id, block.timestamp, _value,_tip + _reward);
    }

    //a function to clean up the totalSupply
    function burnTips() external{
        burned += toBurn;
        IController(TELLOR_ADDRESS).burn(toBurn);
        toBurn = 0;
    }
    function removeValue(uint _id, uint256 _timestamp) external {
        require(msg.sender == IController(TELLOR_ADDRESS).addresses(_GOVERNANCE_CONTRACT));
        Report storage rep = reports[_id];
        uint256 _index = rep.timestampIndex[_timestamp];
        for (uint256 i = _index; i < rep.timestamps.length-1; i++){
            rep.timestamps[i] = rep.timestamps[i+1];
        }
        delete rep.timestamps[rep.timestamps.length-1];
        rep.timestamps.pop();
        rep.valueByTimestamp[_timestamp] = "";
    }

    function verify() external pure returns(uint){
        return 9999;
    }

    function changeMiningLock(uint256 _newMiningLock) external{
        require(msg.sender == IController(TELLOR_ADDRESS).addresses(_GOVERNANCE_CONTRACT));
        miningLock = _newMiningLock;
    }

    //Getters

    function getTipsById(uint _id) external view returns(uint256){
        return tips[_id];
    }

    function getReportDetails(uint256 _id) external view returns(bytes memory){
        return reports[_id].details;
    }

    function getTimestampCountByID(uint256 _id) external view returns(uint256){
        return reports[_id].timestamps.length;
    }   

    function getTimestampIndexByTimestamp(uint256 _id, uint256 _timestamp) external view returns(uint256){
        return reports[_id].timestampIndex[_timestamp];
    }

    function getReportTimestampByIndex(uint256 _requestId, uint256 _index) external view returns(uint256){
        return reports[_requestId].timestamps[_index];
    }

    function getReportsSubmittedByAddress(address _reporter) external view returns(uint256){
        return reportsSubmittedByAddress[_reporter];
    }

    function getTipsByUser(address _user) external view returns(uint256){
        return tipsByUser[_user];
    }

    function getValueByTimestamp(uint256 _requestId, uint256 _timestamp) external view returns(bytes memory){
        return reports[_requestId].valueByTimestamp[_timestamp];
    }

    function getBlockNumberByTimestamp(uint256 _requestId, uint256 _timestamp) external view returns(uint256){
        return reports[_requestId].timestampToBlockNum[_timestamp];
    }

    function getReporterByTimestamp(uint256 _requestId, uint256 _timestamp) external view returns(address){
        return reports[_requestId].reporterByTimestamp[_timestamp];
    }
}