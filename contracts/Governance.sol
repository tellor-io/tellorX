// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;


contract Governance{

    constant TELLOR_ADDRESS = 0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0;

    uint256 voteCount;
    uint256 disputeFee;
    bool private lock;
    mapping (address => Voter) voter;
    mapping (address => Delegation[]) public delegateInfo;
    enum ListedContract{CONTROLLER, TREASURY, ORACLE, GOVERNANCE};
    enum VoteResult{FAILED,PASSED,INVALID};
    mapping(bytes => bool) functionApproved;
    mapping(bytes32 => uint[]) voteRounds;//shows if a certain vote has already started
    mapping(uint => Vote) voteInfo;
    mapping(uint => Dispute) disputeInfo;
    mapping(uint => uint) openDisputesOnId;
    mapping(uint => TypeDetails) voteInformation;// (1 - dispute, 2- upgrade proposal, 3- variable change)

    struct Delegation {
        address delegate,
        uint fromBlock
    }

    struct Dispute {
        uint requestID;
        uint timestamp;
        bytes value;
        address reportedMiner; //miner who submitted the 'bad value' will get disputeFee if dispute vote fails
        address reportingParty; //miner reporting the 'bad value'-pay disputeFee will get reportedMiner's stake if dispute vote passes
    }

    struct Vote {
        bytes32 identifierHash;
        uint type;
        uint voteRound;
        uint startDate;
        uint blockNumber;
        uint256 fee;
        uint tallyDate;
        uint supports;
        uint against;
        bool executed; //is the dispute settled
        VoteResult result; //did the vote pass?
        bool isDispute;
        uint256 invalidQuery;
        bytes data;
        bytes function;
        address voteAddress; //address of contract to execute function on
        mapping(address => bool) voted; //mapping of address to whether or not they voted
    }

    struct TypeDetails{
        uint quorum;
        uint voteDuration;
    }

    constructor{
        //set initial type details in a mapping
         -- upgrade needs addy, contract to upgrade
 -- mint needs addy/ uint
 -- treasury needs amount, rate, duration
 -- newID needs bytes details
 -- addNewFunction here in governance
    }
/**
     * @dev Helps initialize a dispute by assigning it a disputeId
     * when a miner returns a false/bad value on the validate array(in Tellor.ProofOfWork) it sends the
     * invalidated value information to POS voting
     * @param _requestId being disputed
     * @param _timestamp being disputed
     */
    function beginDispute(uint256 _requestId,uint256 _timestamp) external {
        address _oracle = ITELLOR(TELLOR_MASTER).addresses(ORACLE_CONTRACT);
        Report memory _report = ITellor(_oracle).reports(_requestId);
        require(_report.timestampToBlockNum(_timestamp) != 0, "Mined block is 0");
        address _miner = _request.minersByValue[_timestamp];
        bytes32 _hash = keccak256(abi.encodePacked(_requestId, _timestamp));
        voteCount++;
        uint256 _id = voteCount;
        voteRounds[_hash].push(_id);
        if (voteRounds[_hash].length > 1) {
            _prevId = voteRounds[_hash][voteRounds[_hash].length - 2]
            require(now - voteInfo[_prevId].tallyDate < 1 day);//1 day for new disputes
        } else {
            require(block.timestamp - _timestamp < ITellor(_oracle).miningLock, "Dispute must be started within 12 hours...same variable as mining lock");
        }
        Vote storage _thisVote = voteInfo[_id];
        Dispute storage _thisDispute = disputeInfo[_id];
        _thisVote.identifierHash = _hash;
        _thisDispute.requestID = _requestId;
        _thisDispute.timestamp = _timestamp;
        _thisDispute.value = ITellor(_oracle).getValue()
        _thisDispute.reportedMiner = ITellor(_oracle).getMiner;
        _thisDispute.reportingParty = msg.sender;
        _thisVote.blockNumber = block.number;
        _thisVote.startDate = block.timestamp;
        _thisVote.voteRound = voteRounds[_hash].length;
        _thisVote.isDispute = true;
        openDisputesOnId[_requestId]++;
        uint256 _fee = disputeFee * openDisputesOnId * voteRounds[_hash].length;//check this
        _thisVote.fee = _fee * .9;
        _doTransfer(msg.sender, address(this), _fee);
        ITellor(_oracle).addTip(_requestId,_fee*.1);
        ITellor(_oracle).removeValue(_id,_timestamp);//Pull value from on-chain
        ITELLOR(TELLOR_MASTER)changeStakingStatus(_miner,3);
        emit NewDispute(disputeId, _requestId, _timestamp, _miner);
    }

    function delegate(address _delegate) external{
        Delegation[] storage checkpoints = delegateInfo[msg.sender];
        if (
            checkpoints.length == 0 ||
            checkpoints[checkpoints.length - 1].fromBlock != block.number
        ) {
            checkpoints.push(
                Delegation({
                    delegate: _delegate,
                    fromBlock: uint128(block.number)
                })
            );
        } else {
            Delegation storage oldCheckPoint =
                checkpoints[checkpoints.length - 1];
            oldCheckPoint.delegate = _delegate;
        }
    }

   function proposeVote(ListedContract _contract,bytes _function, bytes _data) public{
        Vote storage _thisVote = voteInfo[_id];
        voteCount++;
        uint256 _id = voteCount;
        bytes32 _hash = keccak256(abi.encodePacked(_contract,_function,_data));
         voteRounds[_hash].push(_id);
        if (voteRounds[_hash].length > 1) {
            _prevId = voteRounds[_hash][voteRounds[_hash].length - 2]
            require(now - voteInfo[_prevId].tallyDate < 1 day);//1 day for new disputes
        } 
        _thisVote.identifierHash = _hash;
        uint256 _fee = 100e18 * 2**(voteRounds[_hash].length - 1)
        _doTransfer(msg.sender, address(this), _fee); //This is the fork fee (just 100 tokens flat, no refunds.  Goes up quickly to dispute a bad vote)
        _thisVote.voteRound = voteRounds[_hash].length;
        _thisVote.startDate = block.timestamp;
        _thisVote.blockNumber = block.number;
        _thisVote.fee = _fee;
        _thisVote.data = _data;
        _thisVote.function = _function;
        _thisVote.voteAddress = _contract;
        require(functionApproved[_function]);
        emit NewVote(_contract,_function,_data);
    }
    function vote(uint256 _voteId, bool _supports, bool _invalidQuery) external {
        require(_disputeId <= voteCount, "dispute does not exist");
        Vote storage _thisVote = voteInfo[_id];
        require(!_thisVote.tallyDate == 0, "the vote has already been executed");
        uint256 voteWeight = balanceOfAt(msg.sender, disp.disputeUintVars[_BLOCK_NUMBER]);
        voteWeight += oracleMines();
        voteWeight += oracleTips()/2;
        require(stakingStatus != 3)
        require(_thisVote.voted[msg.sender] != true, "Sender has already voted");
        require(voteWeight != 0, "User balance is 0");
        _thisVote.voted[msg.sender] = true;
        if(_thisVote.isDispute && _invalidQuery){
            _thisVote.invalidQuery += voteWeight;
        } else if(_supports) {
            _thisVote.tally = _thisvote.tally.add(int256(voteWeight));
        } else {
            _thisVote.tally =_thisVote.tally.sub(int256(voteWeight));
        }
        emit Voted(_voteteId, _supports, msg.sender, voteWeight,_invalidQuery);
    }

    /**
     * @dev tallies the votes and begins the 1 day challenge period
     * @param _disputeId is the dispute id
     */
    function tallyVotes(uint256 _id) external {
        Vote storage _thisVote = voteInfo[_id];
        //Ensure this has not already been executed/tallied
        require(_thisVote.executed == false, "Dispute has been already executed");
        require(_thisVote.tallyDate == 0, "vote should not already be tallied");
        require(
            block.timestamp -_thisVote.startDate > voteInformation[_thisVote.type].voteDuration,
            "Time for voting haven't elapsed"
        );
        int256 _tally = disp.tally;
        if(_thisVote.invalidQuery > _thisVote.supports && _thisVote.invalidQuery > _thisVote.against){
            _thisVote.result = INVALID;
        }
        else if (_thisVote.supports > _thisVote.against) {
                if (uint256(_tally) >= ((uints[_TOTAL_SUPPLY] * voteInformation[_thisVote.type].quorum) / 100)) {
                _thisVote.result = PASSED;
                if(_thisVote.isDispute && stakes.currentStatus == 3){
                        stakes.currentStatus = 4;
                }
            }
        }
        else{
            _thisVote.result = FAILED;
        }
        _thisVote.tallyDate = block.timestamp;
        emit VoteTallied(_id, _thisVote.result);
    }

    function executeVote(uint256 _id) external{
        Vote storage _thisVote = voteInfo[_id];
        require(_id < voteCount);
        require(!_thisVote.executed, "Vote has been executed");
        require(_thisVote.tallyDate > 0, "Vote must be tallied");
        require(voteRounds[_thisVote.identifierHash].length == _thisVote.voteRound, "must be the final vote");
        require(block.timestamp - _thisVote.tallyDate > 86400 * _thisVote.voteRound, "vote needs to be tallied and time must pass");
        _thisVote.exectued = true;
        if(!_thisVote.isDispute){
            if _thisVote.result = PASSED{
                (_succ, _res) = _destination.call(_data);
            }
            emit VoteExecuted();
        }else{
            Dispute storage _thisDispute = disputeInfo[_id];
            if(_thisVote.result == PASSED){
                for(i=voteRounds[_thisVote.identifierHash].length-1;i>=0;i--){
                    if( i == 0){
                        Itellor(TellorMaster).slashMiner(_thisDispute.reportedMiner ,_thisDispute.reportingParty);
                    }
                    Itellor(TellorMaster).transfer(_thisDispute.reportingParty,_thisVote.fee);
                }
                Itellor(TellorMaster).changeStakingStatus(_thisDispute.reportedMiner,5);
            }else if(_thisVote.result == INVALID){
                for(i=voteRounds[_thisVote.identifierHash].length-1;i>=0;i--){
                    Itellor(TellorMaster).transfer(_thisDispute.reportingParty,_thisVote.fee);
                }
                Itellor(TellorMaster).changeStakingStatus(_thisDispute.reportedMiner,1);
            }else if(_thisVote.result == FAILED){
                for(i=voteRounds[_thisVote.identifierHash].length-1;i>=0;i--){
                    Itellor(TellorMaster).transfer(_thisDispute.reportedMiner,_thisVote.fee);
                }
                Itellor(TellorMaster).changeStakingStatus(_thisDispute.reportedMiner,1);
            }
            openDisputesOnId[_requestId]--;
            emit DisputeSettled();
        }
    }

        /**
     * @dev This function updates the minimum dispute fee as a function of the amount
     * of staked miners
     */
    function updateMinDisputeFee() public {
        uint256 _stakeAmt = uints[_STAKE_AMOUNT];
        uint256 _trgtMiners = uints[_TARGET_MINERS];
        disputeFee = SafeMath.max(
            15e18,
            (_stakeAmt -
                ((_stakeAmt *
                    (SafeMath.min(_trgtMiners, uints[_STAKE_COUNT]) * 1000)) /
                    _trgtMiners) /
                1000)
        );
    }

    function verify() public returns(uint){
        return 9999;
    }
}