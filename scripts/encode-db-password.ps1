$ErrorActionPreference = 'Stop'

$securePassword = Read-Host 'Enter the Supabase database password' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
  $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)

  if ([string]::IsNullOrWhiteSpace($plainPassword)) {
    throw 'Database password cannot be empty.'
  }

  $encodedPassword = [Uri]::EscapeDataString($plainPassword)
  Set-Clipboard -Value $encodedPassword
  Write-Host 'Encoded password copied to the clipboard. Plaintext was not printed or saved.'
}
finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  $plainPassword = $null
  $encodedPassword = $null
  $securePassword.Dispose()
}
