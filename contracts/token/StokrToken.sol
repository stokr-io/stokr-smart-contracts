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

    /// @dev Log entry on self destruction of the token
    event TokenDestroyed();

    /// @dev Constructor
    /// @param _whitelist       Ethereum address of whitelist contract
    /// @param _tokenRecoverer  Ethereum address of token recoverer
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

    /// @dev  Self destruct can only be called by crowdsale contract in case the goal wasn't reached
    function destruct() public onlyMinter {
        selfdestruct(owner);
        emit TokenDestroyed();
    }

    /// @dev Recover token
    /// @param _oldAddress  address of old account
    /// @param _newAddress  address of new account
    function recoverToken(address _oldAddress, address _newAddress)
        public
        onlyTokenRecoverer
        onlyWhitelisted(_newAddress)
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

    /// @dev  Total supply of this token
    /// @return  Token amount
    function totalSupply() public view returns (uint) {
        return totalSupply_;
    }

    /// @dev  Token balance
    /// @param _investor  Ethereum address of token holder
    /// @return           Token amount
    function balanceOf(address _investor) public view returns (uint) {
        return accounts[_investor].balance;
    }

    /// @dev  Allowed token amount a third party trustee may transfer
    /// @param _investor  Ethereum address of token holder
    /// @param _spender   Ethereum address of third party
    /// @return           Allowed token amount
    function allowance(address _investor, address _spender) public view returns (uint) {
        return allowance_[_investor][_spender];
    }

    /// @dev  Approve a third party trustee to transfer tokens
    ///       Note: additional requirements are enforced within internal function.
    /// @param _spender  Ethereum address of third party
    /// @param _value    Maximum token amount that is allowed to get transferred
    /// @return          Always true
    function approve(address _spender, uint _value) public returns (bool) {
        return _approve(msg.sender, _spender, _value);
    }

    /// @dev  Increase the amount of tokens a third party trustee may transfer
    ///       Note: additional requirements are enforces within internal function.
    /// @param _spender  Ethereum address of third party
    /// @param _amount   Additional token amount that is allowed to get transferred
    /// @return          Always true
    function increaseAllowance(address _spender, uint _amount) public returns (bool) {
        require(allowance_[msg.sender][_spender] + _amount >= _amount, "Allowance overflow");

        return _approve(msg.sender, _spender, allowance_[msg.sender][_spender].add(_amount));
    }

    /// @dev  Decrease the amount of tokens a third party trustee may transfer
    ///       Note: additional requirements are enforces within internal function.
    /// @param _spender  Ethereum address of third party
    /// @param _amount   Reduced token amount that is allowed to get transferred
    /// @return          Always true
    function decreaseAllowance(address _spender, uint _amount) public returns (bool) {
        require(_amount <= allowance_[msg.sender][_spender], "Amount exceeds allowance");

        return _approve(msg.sender, _spender, allowance_[msg.sender][_spender].sub(_amount));
    }

    /// @dev  Check if a token transfer is possible
    /// @param _from   Ethereum address of token sender
    /// @param _to     Ethereum address of token recipient
    /// @param _value  Token amount to transfer
    /// @return        True iff a transfer with given pramaters would succeed
    function canTransfer(address _from, address _to, uint _value)
        public view returns (bool)
    {
        return totalSupplyIsFixed
            && _from != address(0x0)
            && _to != address(0x0)
            && _value <= accounts[_from].balance
            && whitelist.isWhitelisted(_from)
            && whitelist.isWhitelisted(_to);
    }

    /// @dev  Check if a token transfer by third party is possible
    /// @param _spender  Ethereum address of third party trustee
    /// @param _from     Ethereum address of token holder
    /// @param _to       Ethereum address of token recipient
    /// @param _value    Token amount to transfer
    /// @return          True iff a transfer with given pramaters would succeed
    function canTransferFrom(address _spender, address _from, address _to, uint _value)
        public view returns (bool)
    {
        return canTransfer(_from, _to, _value) && _value <= allowance_[_from][_spender];
    }

    /// @dev  Token transfer
    ///       Note: additional requirements are enforces within internal function.
    /// @param _to     Ethereum address of token recipient
    /// @param _value  Token amount to transfer
    /// @return        Always true
    function transfer(address _to, uint _value) public returns (bool) {
        return _transfer(msg.sender, _to, _value);
    }

    /// @dev  Token transfer by a third party
    ///       Note: additional requirements are enforces within internal function.
    /// @param _from   Ethereum address of token holder
    /// @param _to     Ethereum address of token recipient
    /// @param _value  Token amount to transfer
    /// @return        Always true
    function transferFrom(address _from, address _to, uint _value) public returns (bool) {
        require(_value <= allowance_[_from][msg.sender], "Amount exceeds allowance");

        return _approve(_from, msg.sender, allowance_[_from][msg.sender].sub(_value))
            && _transfer(_from, _to, _value);
    }

    /// @dev  Approve a third party trustee to transfer tokens (internal implementation)
    /// @param _from     Ethereum address of token holder
    /// @param _spender  Ethereum address of third party
    /// @param _value    Maximum token amount the trustee is allowed to transfer
    /// @return          Always true
    function _approve(address _from, address _spender, uint _value)
        internal
        onlyWhitelisted(_from)
        onlyWhenTotalSupplyIsFixed
        returns (bool)
    {
        allowance_[_from][_spender] = _value;

        emit Approval(_from, _spender, _value);

        return true;
    }

    /// @dev  Token transfer (internal implementation)
    /// @param _from   Ethereum address of token sender
    /// @param _to     Ethereum address of token recipient
    /// @param _value  Token amount to transfer
    /// @return        Always true
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
