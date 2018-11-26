pragma solidity 0.4.24;


/// @title RateSource
/// @author SICOS
interface RateSource {

    /// @dev The current price of an Ether in EUR cents
    /// @return Current ether rate
    function etherRate() external returns(uint);

}

