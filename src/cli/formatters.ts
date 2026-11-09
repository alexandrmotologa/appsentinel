import pc from 'picocolors';

export class TerminalFormatters {
  public static banner(): void {
    console.log(
      pc.cyan(
        [
          '    ___                  ____             __   _            __',
          '   /   |  ____  ____    / __/___  ____   / /_ (_)____  ___ / /',
          '  / /| | / __ \\/ __ \\  _\\ \\ / _ \\/ __ \\ / __// // __ \\/ _ \\/ / ',
          ' / ___ |/ /_/ / /_/ / ___/ /  __/ / / // /_ / // / / /  __/ /  ',
          '/_/  |_/ .___/ .___/ /____/\\___/_/ /_/ \\__//_//_/ /_/\\___/_/   ',
          '      /_/   /_/                                                ',
        ].join('\n')
      )
    );
    console.log(
      pc.dim('Mobile Review Triage, Hardware Extraction & Spike Alerter\n')
    );
  }

  public static info(msg: string): void {
    console.log(`${pc.blue('ℹ')} ${msg}`);
  }

  public static success(msg: string): void {
    console.log(`${pc.green('✔')} ${msg}`);
  }

  public static warn(msg: string): void {
    console.log(`${pc.yellow('⚠')} ${msg}`);
  }

  public static error(msg: string): void {
    console.error(`${pc.red('✖')} ${msg}`);
  }

  public static incident(
    severity: string,
    appName: string,
    version: string,
    category: string,
    count: number,
    summary: string
  ): void {
    const isCritical = severity === 'P1_CRITICAL';
    const badge = isCritical ? pc.bgRed(pc.white(` ${severity} `)) : pc.bgYellow(pc.black(` ${severity} `));

    console.log(`\n${badge} ${pc.bold(appName)} v${version} - ${pc.magenta(category)}`);
    console.log(`  ${pc.dim('Reports in window:')} ${pc.bold(String(count))}`);
    console.log(`  ${pc.dim('Summary:')} ${summary}\n`);
  }
}
