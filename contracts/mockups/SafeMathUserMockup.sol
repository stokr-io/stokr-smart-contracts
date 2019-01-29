pragma solidity 0.4.25;

import "../math/SafeMath.sol";


contract SafeMathUserMockup {
    using SafeMath for uint;

    function sum(uint x, uint y) public pure returns (uint) {
        return x.add(y);
    }

    function diff(uint x, uint y) public pure returns (uint) {
        return x.sub(y);
    }

    function prod(uint x, uint y) public pure returns (uint) {
        return x.mul(y);
    }

    function quot(uint x, uint y) public pure returns (uint) {
        return x.div(y);
    }

}

