<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminSeeder extends Seeder
{
    public function run(): void
    {
        // Must match login placeholder in frontend (translations: admin@factory.com).
        $devPassword = Hash::make('12345678');

        User::updateOrCreate(
            ['email' => 'admin@factory.com'],
            [
                'name'     => 'Admin',
                'password' => $devPassword,
                'role'     => 'admin',
                'status'   => 'active',
            ]
        );

        User::updateOrCreate(
            ['email' => 'mohammed@gmail.com'],
            [
                'name'     => 'Mohammed',
                'password' => $devPassword,
                'role'     => 'admin',
                'status'   => 'active',
            ]
            
        );
    }
}
