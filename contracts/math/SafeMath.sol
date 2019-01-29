pragma solidity 0.4.25;


/// @title SafeMath
/// @dev Math operations with safety checks that throw on error
library SafeMath {

    /// @dev Add two integers
    function add(uint a, uint b) internal pure returns (uint) {
        uint c = a + b;

        assert(c >= a);

        return c;
    }

    /// @dev Subtract two integers
    function sub(uint a, uint b) internal pure returns (uint) {
        assert(b <= a);

        return a - b;
    }

    /// @dev Multiply tow integers
    function mul(uint a, uint b) internal pure returns (uint) {
        if (a == 0) {
            return 0;
        }

        uint c = a * b;

        assert(c / a == b);

        return c;
    }

    /// @dev Floor divide two integers
    function div(uint a, uint b) internal pure returns (uint) {
        return a / b;
    }

}
