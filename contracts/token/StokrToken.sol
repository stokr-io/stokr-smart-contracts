pragma solidity 0.4.25;

import "../whitelist/Whitelisted.sol";
import "./TokenRecoverable.sol";
import "./MintableToken.sol";


/// @title StokrToken
/// @author Stokr
contract StokrToken is MintableToken, TokenRecoverable {

    string public name;
    string public symbol;
    uint8 public constant decimals = 18;

    mapping(address => mapping(address => uint)) internal allowance_;

    /// @dev Constructor
    /// @param _whitelist address of whitelist contract
    /// @param _tokenRecoverer  address of token recoverer
    constructor(
        string _name,
        string _symbol,
        Whitelist _whitelist,
        address _profitDepositor,
        address _profitDistributor,
        address _tokenRecoverer
    )
        public
        Whitelisted(_whitelist)
        ProfitSharing(_profitDepositor, _profitDistributor)
        TokenRecoverable(_tokenRecoverer)
    {
        name = _name;
        symbol = _symbol;
    }

    /// @dev Self destruct can only be called by crowdsale contract
    /// in case the goal is not reached
    function destruct() public onlyMinter {
        selfdestruct(owner);
    }

    /// @dev Recover token
    /// @param _oldAddress  address of old account
    /// @param _newAddress  address of new account
    function recoverToken(address _oldAddress, address _newAddress)
        public
        onlyTokenRecoverer
    {
        // Ensure that new address is *not* an existing account.
        // Check for account.profitShare is not needed because of following implication:
        //   (account.lastTotalProfits == 0) ==> (account.profitShare == 0)
        require(accounts[_newAddress].balance == 0 && accounts[_newAddress].lastTotalProfits == 0,
                "New address exists already");

        updateProfitShare(_oldAddress);

        accounts[_newAddress] = accounts[_oldAddress];
        delete accounts[_oldAddress];

        emit TokenRecovery(_oldAddress, _newAddress);
        emit Transfer(_oldAddress, _newAddress, accounts[_newAddress].balance);
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
        onlyWhenTotalSupplyIsFixed
        returns (bool)
    {
        allowance_[msg.sender][_spender] = _value;

        emit Approval(msg.sender, _spender, _value);

        return true;
    }

    /// @dev Transfer
    /// @param _to An Ethereum address
    /// @param _value A positive number
    /// @return True or false
    function transfer(address _to, uint _value) public returns (bool) {
        return _transfer(msg.sender, _to, _value);
    }

    /// @dev Transfer from
    /// @param _from An Ethereum address
    /// @param _to An Ethereum address
    /// @param _value A positive number
    /// @return True or false
    function transferFrom(address _from, address _to, uint _value) public returns (bool) {
        require(_value <= allowance_[_from][msg.sender], "Amount exceeds allowance");

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
        onlyWhenTotalSupplyIsFixed
        returns (bool)
    {
        require(_to != address(0x0), "Recipient is zero");
        require(_value <= accounts[_from].balance, "Amount exceeds balance");

        updateProfitShare(_from);
        updateProfitShare(_to);

        accounts[_from].balance = accounts[_from].balance.sub(_value);
        accounts[_to].balance = accounts[_to].balance.add(_value);

        emit Transfer(_from, _to, _value);

        return true;
    }

}
