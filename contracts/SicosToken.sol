pragma solidity 0.4.19;

import "./MintableToken.sol";
import "./KeyRecoverable.sol";
import "./Whitelisted.sol";


/// @title SicosToken
/// @author Autogenerated from a Dia UML diagram
contract SicosToken is MintableToken, KeyRecoverable {

    mapping(address => mapping(address => uint)) internal allowance_;

    /// @dev Constructor
    /// @param _whitelist An Ethereum address
    /// @param _keyRecoverer An Ethereum address
    function SicosToken(address _whitelist, address _profitDepositor, address _keyRecoverer)
        public
        Whitelisted(_whitelist)
        ProfitSharing(_profitDepositor)
        KeyRecoverable(_keyRecoverer)
    {}

    /// @dev Recover key
    /// @param _oldAddress An Ethereum address
    /// @param _newAddress An Ethereum address
    function recoverKey(address _oldAddress, address _newAddress)
        public
        onlyKeyRecoverer
        onlyWhitelisted(_oldAddress)
        onlyWhitelisted(_newAddress)
    {
        // Ensure that new address is *not* an existing account.
        // Check for account.profitShare is not needed because of following implication:
        //   (account.lastTotalProfits == 0) ==> (account.profitShare == 0)
        require(accounts[_newAddress].balance == 0 && accounts[_newAddress].lastTotalProfits == 0);

        updateProfitShare(_oldAddress);

        accounts[_newAddress] = accounts[_oldAddress];
        delete accounts[_oldAddress];

        KeyRecovered(_oldAddress, _newAddress);
    }

    /// @dev Total supply
    /// @return A positive number
    function totalSupply() public view returns (uint) {
        return totalSupply_;
    }

    /// @dev Balance of
    /// @param _investor An Ethereum address
    /// @return A positive number
    function balanceOf(address _investor) public view returns (uint) {
        return accounts[_investor].balance;
    }

    /// @dev Allowance
    /// @param _investor An Ethereum address
    /// @param _spender An Ethereum address
    /// @return A positive number
    function allowance(address _investor, address _spender) public view returns (uint) {
        return allowance_[_investor][_spender];
    }

    /// @dev Approve
    /// @param _spender An Ethereum address
    /// @param _value A positive number
    /// @return True or false
    function approve(address _spender, uint _value)
        public
        onlyWhitelisted(msg.sender)
        notMinting
        returns (bool)
    {
        allowance_[msg.sender][_spender] = _value;

        Approval(msg.sender, _spender, _value);

        return true;
    }

    /// @dev Transfer
    /// @param _to An Ethereum address
    /// @param _value A positive number
    /// @return True or false
    function transfer(address _to, uint _value) returns (bool) {
        return _transfer(msg.sender, _to, _value);
    }

    /// @dev Transfer from
    /// @param _from An Ethereum address
    /// @param _to An Ethereum address
    /// @param _value A positive number
    /// @return True or false
    function transferFrom(address _from, address _to, uint _value) returns (bool) {
        require(_value <= allowance_[_from][msg.sender]);

        allowance_[_from][msg.sender] = allowance_[_from][msg.sender].sub(_value);

        return _transfer(_from, _to, _value);
    }

    /// @dev Transfer
    /// @param _from An Ethereum address
    /// @param _to An Ethereum address
    /// @param _value A positive number
    /// @return True or false
    function _transfer(address _from, address _to, uint _value)
        internal
        onlyWhitelisted(_from)
        onlyWhitelisted(_to)
        notMinting
        returns (bool)
    {
        require(_to != address(0));
        require(_value <= accounts[_from].balance);

        updateProfitShare(_from);
        updateProfitShare(_to);

        accounts[_from].balance = accounts[_from].balance.sub(_value);
        accounts[_to].balance = accounts[_to].balance.add(_value);

        Transfer(_from, _to, _value);

        return true;
    }

}
