pragma solidity 0.4.25;

import "../ownership/Ownable.sol";


/// @title TokenRecoverable
/// @author STOKR
contract TokenRecoverable is Ownable {

    // Address that can do the TokenRecovery
    address public tokenRecoverer;

    /// @dev Event emitted when the TokenRecoverer changes
    /// @param newTokenRecoverer Ethereum address of new TokenRecoverer
    event TokenRecovererChange(address indexed newTokenRecoverer);

    /// @dev Event emitted in case of a TokenRecovery
    /// @param oldAddress Ethereum address of old account
    /// @param newAddress Ethereum address of new account
    event TokenRecovery(address indexed oldAddress, address indexed newAddress);

    /// @dev Restrict operation to token recoverer
    modifier onlyTokenRecoverer() {
        require(msg.sender == tokenRecoverer, "Restricted to token recoverer");
        _;
    }

    /// @dev Constructor
    /// @param _tokenRecoverer address
    constructor(address _tokenRecoverer) public {
        setTokenRecoverer(_tokenRecoverer);
    }

    /// @dev Set token recoverer
    /// @param _newTokenRecoverer address
    function setTokenRecoverer(address _newTokenRecoverer) public onlyOwner {
        require(_newTokenRecoverer != address(0x0), "New token recoverer is zero");

        if (tokenRecoverer != address(0x0) && _newTokenRecoverer != tokenRecoverer) {
            emit TokenRecovererChange(_newTokenRecoverer);
        }
        tokenRecoverer = _newTokenRecoverer;
    }

    /// @dev Recover token
    /// @param _oldAddress address
    /// @param _newAddress address
    function recoverToken(address _oldAddress, address _newAddress) public;

}
