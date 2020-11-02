pragma solidity 0.5.16;

import "../crowdsale/RateSourceInterface.sol";


contract RateSourceMockup is RateSource {

    uint private etherRate_;

    constructor (uint etherRate) public {
        etherRate_ = etherRate;
    }

    function etherRate() public view returns (uint) {
        return etherRate_;
    }

}

