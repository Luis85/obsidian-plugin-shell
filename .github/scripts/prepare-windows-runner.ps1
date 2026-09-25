# Hosted Windows runners only. File-heavy tests write their temporary projects
# under TEMP; put TEMP on a Dev Drive and exclude the job's working folders from
# real-time scanning. Both are speed-only: when either is unavailable the job
# keeps the runner default with a visible warning, and no check changes.
$ErrorActionPreference = 'Stop'
try {
  $vhd = Join-Path $env:RUNNER_TEMP 'dev-drive.vhdx'
  $volume = New-VHD -Path $vhd -SizeBytes 25GB -Dynamic |
    Mount-VHD -Passthru |
    Initialize-Disk -PartitionStyle GPT -PassThru |
    New-Partition -AssignDriveLetter -UseMaximumSize |
    Format-Volume -DevDrive -Confirm:$false -Force
  $root = "$($volume.DriveLetter):\"
  fsutil devdrv trust "$($volume.DriveLetter):" | Out-Null
  Write-Output "Dev Drive mounted at $root"
} catch {
  Write-Output "::warning::Dev Drive unavailable ($($_.Exception.Message)); using the runner temp disk."
  $root = $env:RUNNER_TEMP
}
$temp = Join-Path $root 'tmp'
New-Item -ItemType Directory -Force -Path $temp | Out-Null
"TEMP=$temp", "TMP=$temp" | Out-File -FilePath $env:GITHUB_ENV -Encoding utf8 -Append
try {
  Add-MpPreference -ExclusionPath $root, $env:GITHUB_WORKSPACE, $env:RUNNER_TEMP
  Write-Output 'Real-time scanning excluded for the workspace, runner temp and TEMP.'
} catch {
  Write-Output "::warning::Defender exclusion unavailable ($($_.Exception.Message))."
}
# Speed-only preparation must never decide the job result.
exit 0
